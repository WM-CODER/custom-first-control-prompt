import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage, LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import * as CustomFirstControlPrompt from '@deepseek-ai/dsh-custom-first-control-prompt'
import { SEED_SOURCE } from '../src/seed.ts'

const PAIRS = [
  { user: '用户测试提示词1', assistant: '助手提示词1' },
  { user: '用户测试提示词2', assistant: '助手提示词2' },
]

/** Minimal valid text response, following the agent-loop mock-adapter shape. */
function textChunks(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

/** Script-driven mock adapter recording every request it receives. */
class CaptureAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(private readonly script: StreamChunk[][]) {
    super()
  }

  override resolveModel(provider: string, model: string) {
    return Promise.resolve({ provider, id: model, name: model })
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const entry = this.script.shift()
    if (entry === undefined) throw new Error('CaptureAdapter: script exhausted')
    for (const chunk of entry) yield chunk
  }
}

/** Flatten a request's messages to their text payloads, for order assertions. */
function texts(options: GenerateOptions): string[] {
  return options.messages.map(message =>
    message.content.map(block => (block.type === 'text' ? block.text : '')).join(''))
}

/** Drain a stream so the request actually reaches the adapter. */
async function drain(stream: AsyncIterable<StreamChunk>): Promise<void> {
  for await (const chunk of stream) void chunk
}

/** Mount the standard stack plus the plugin under test. */
async function harness(adapter: CaptureAdapter, config: Record<string, unknown> = {}): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  ctx.llm.registerAdapter(['mock'], adapter)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(CustomFirstControlPrompt, { history: PAIRS, ...config })
  return ctx
}

describe('request-path seed injection', () => {
  it('prepends the reference exchanges to the conversation request without touching the session log', async () => {
    const adapter = new CaptureAdapter([textChunks('ok')])
    const ctx = await harness(adapter)
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('intercept-main'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'hello' }],
        source: { kind: 'user' },
      }))
      await handle.agent.whenIdle()

      expect(adapter.requests).toHaveLength(1)
      const request = adapter.requests[0]!
      // Seed exchanges lead, then the real prompt — real alternating roles.
      expect(texts(request)).toEqual([
        '用户测试提示词1', '助手提示词1', '用户测试提示词2', '助手提示词2', 'hello',
      ])
      expect(request.messages.map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user'])
      expect(request.messages[1]?.source).toEqual({ kind: 'plugin', plugin: SEED_SOURCE })
      // The adapter received the redispatched clone, not the frozen loop original.
      expect(Object.isFrozen(request)).toBe(false)

      // The log carries only the real conversation: no seed messages, no extra
      // turns, and real turn numbering starts at 1 (a log-seeding design would
      // collide turn numbers, the request path cannot).
      const session = handle.agent.session
      const userTexts = session.events
        .filter(event => event.type === 'user/message')
        .map(event => event.type === 'user/message'
          ? event.data.content.map(block => (block.type === 'text' ? block.text : '')).join('')
          : '')
      expect(userTexts).toEqual(['hello'])
      expect(session.events.some(event =>
        event.type === 'user/message' && event.data.source.kind === 'plugin')).toBe(false)
      expect(session.events.filter(event => event.type === 'turn/start')
        .map(event => event.type === 'turn/start' ? event.data.turn : 0)).toEqual([1])
    } finally {
      await handle.dispose()
    }
  })

  it('injects on every conversation request, so compaction cannot shadow the reference history', async () => {
    const adapter = new CaptureAdapter([textChunks('one'), textChunks('two')])
    const ctx = await harness(adapter)
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('intercept-repeat'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      for (const text of ['first', 'second']) {
        handle.agent.followup(createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'user' },
        }))
        await handle.agent.whenIdle()
      }
      expect(adapter.requests).toHaveLength(2)
      for (const request of adapter.requests) {
        expect(texts(request).slice(0, 4)).toEqual(['用户测试提示词1', '助手提示词1', '用户测试提示词2', '助手提示词2'])
      }
      expect(texts(adapter.requests[1]!).at(-1)).toBe('second')
    } finally {
      await handle.dispose()
    }
  })

  it('keeps auxiliary calls purpose-clean: session-title and compaction bypass the seeds', async () => {
    const adapter = new CaptureAdapter([textChunks('t'), textChunks('ok')])
    const ctx = await harness(adapter)
    await drain(ctx.llm.stream({
      provider: 'mock',
      model: 'mock',
      purpose: 'session-title',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'summarize' }],
        source: { kind: 'user' },
      })],
    }))
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('intercept-purpose'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'hello' }],
        source: { kind: 'user' },
      }))
      await handle.agent.whenIdle()
      expect(adapter.requests).toHaveLength(2)
      expect(texts(adapter.requests[0]!)).toEqual(['summarize'])
      expect(texts(adapter.requests[1]!).length).toBe(5)
    } finally {
      await handle.dispose()
    }
  })

  it('passes hand-built requests through untouched (no sessionId)', async () => {
    const adapter = new CaptureAdapter([textChunks('x')])
    const ctx = await harness(adapter)
    await drain(ctx.llm.stream({
      provider: 'mock',
      model: 'mock',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'raw' }],
        source: { kind: 'user' },
      })],
    }))
    expect(adapter.requests).toHaveLength(1)
    expect(texts(adapter.requests[0]!)).toEqual(['raw'])
  })

  it('skips subagent-originated sessions unless opted in', async () => {
    const adapter = new CaptureAdapter([textChunks('sub')])
    const ctx = await harness(adapter)
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('intercept-subagent'),
      agentOptions: { provider: 'mock', model: 'mock' },
      meta: { origin: 'subagent' },
    })
    try {
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'delegate' }],
        source: { kind: 'user' },
      }))
      await handle.agent.whenIdle()
      expect(adapter.requests).toHaveLength(1)
      expect(texts(adapter.requests[0]!)).toEqual(['delegate'])
    } finally {
      await handle.dispose()
    }

    const adapter2 = new CaptureAdapter([textChunks('sub-ok')])
    const ctx2 = await harness(adapter2, { includeSubagents: true })
    const handle2 = await ctx2.agentLoop.createAgent(ctx2, {
      sessionId: SessionId('intercept-subagent-optin'),
      agentOptions: { provider: 'mock', model: 'mock' },
      meta: { origin: 'subagent' },
    })
    try {
      handle2.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'delegate' }],
        source: { kind: 'user' },
      }))
      await handle2.agent.whenIdle()
      expect(adapter2.requests).toHaveLength(1)
      expect(texts(adapter2.requests[0]!).length).toBe(5)
    } finally {
      await handle2.dispose()
    }
  })

  it('a fork of a seeded session is an ordinary conversation copy', async () => {
    const adapter = new CaptureAdapter([textChunks('ok')])
    const ctx = await harness(adapter)
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('intercept-fork-source'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'hello' }],
        source: { kind: 'user' },
      }))
      await handle.agent.whenIdle()
      // The log carries no plugin-attributed messages, so the fork is an
      // ordinary copy: no seed boundary applies and the fork is clean.
      const forked = ctx.sessions.fork(handle.agent.session)
      expect(forked.events.some(event =>
        event.type === 'user/message' && event.data.source.kind === 'plugin')).toBe(false)
    } finally {
      await handle.dispose()
    }
  })
})
