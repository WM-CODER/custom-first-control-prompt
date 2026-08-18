import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { createUserMessage, LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import * as CustomFirstControlPrompt from '@deepseek-ai/dsh-custom-first-control-prompt'
import * as Companion from '@deepseek-ai/dsh-custom-first-control-prompt/invariant'
import { hasSeededHistory, isSeededByPlugin, seededMessageSource, SEED_SOURCE } from '../src/seed.ts'

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

/** Mount the standard stack plus the plugin under test in intercept mode. */
async function harness(adapter: CaptureAdapter, config: Record<string, unknown> = {}): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  ctx.llm.registerAdapter(['mock'], adapter)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(InvariantRegistry, { enabled: true })
  await ctx.plugin(Companion)
  await ctx.plugin(CustomFirstControlPrompt, { history: PAIRS, seedMode: 'intercept', ...config })
  return ctx
}

describe('route C: seedMode intercept', () => {
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
      // turns, and real turn numbering starts at 1 (the route-B turn collision
      // cannot happen — nothing was appended before the loop read its watermark).
      const session = handle.agent.session
      expect(hasSeededHistory(session)).toBe(false)
      const userTexts = session.events
        .filter(event => event.type === 'user/message')
        .map(event => event.type === 'user/message'
          ? event.data.content.map(block => (block.type === 'text' ? block.text : '')).join('')
          : '')
      expect(userTexts).toEqual(['hello'])
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
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'first' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'second' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()

      expect(adapter.requests).toHaveLength(2)
      // Both requests open with the same byte-identical seed prefix (the
      // prebuilt frozen message objects are shared by reference).
      expect(texts(adapter.requests[0]!).slice(0, 4)).toEqual([
        '用户测试提示词1', '助手提示词1', '用户测试提示词2', '助手提示词2',
      ])
      expect(texts(adapter.requests[1]!).slice(0, 4)).toEqual([
        '用户测试提示词1', '助手提示词1', '用户测试提示词2', '助手提示词2',
      ])
      expect(adapter.requests[1]!.messages.slice(0, 4)).toEqual(adapter.requests[0]!.messages.slice(0, 4))
    } finally {
      await handle.dispose()
    }
  })

  it('passes auxiliary and hand-built calls straight through', async () => {
    const adapter = new CaptureAdapter([textChunks('t'), textChunks('h')])
    const ctx = await harness(adapter)
    // Auxiliary call: a purpose stamp must not be intercepted even with a session id.
    await drain(ctx.llm.stream({
      provider: 'mock',
      model: 'mock',
      purpose: 'session-title',
      sessionId: SessionId('intercept-aux'),
      messages: [createUserMessage({ content: [{ type: 'text', text: 'title me' }], source: { kind: 'user' } })],
    }))
    // Hand-built one-shot: no sessionId at all.
    await drain(ctx.llm.stream({
      provider: 'mock',
      model: 'mock',
      messages: [createUserMessage({ content: [{ type: 'text', text: 'one shot' }], source: { kind: 'user' } })],
    }))
    expect(adapter.requests).toHaveLength(2)
    expect(texts(adapter.requests[0]!)).toEqual(['title me'])
    expect(texts(adapter.requests[1]!)).toEqual(['one shot'])
  })

  it('skips subagent-originated sessions unless the deployment opts them in', async () => {
    const adapter = new CaptureAdapter([textChunks('ok')])
    const ctx = await harness(adapter)
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('intercept-sub'),
      agentOptions: { provider: 'mock', model: 'mock' },
      meta: { origin: 'subagent' },
    })
    try {
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'sub hello' }],
        source: { kind: 'user' },
      }))
      await handle.agent.whenIdle()
      expect(adapter.requests).toHaveLength(1)
      expect(texts(adapter.requests[0]!)).toEqual(['sub hello'])
    } finally {
      await handle.dispose()
    }
  })

  it('forks cleanly: the log carries no plugin messages, so no seed-boundary rule applies', async () => {
    const adapter = new CaptureAdapter([textChunks('ok')])
    const ctx = await harness(adapter)
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('intercept-fork-source'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      // Route B fails here on unpatched frameworks (the fork prefix re-enters
      // the seed boundary, which rejects plugin-source assistant messages).
      // Route C logs no plugin messages, so the fork is an ordinary copy.
      const forked = ctx.sessions.fork(handle.agent.session)
      expect(hasSeededHistory(forked)).toBe(false)
      expect(forked.events.filter(event => isSeededByPlugin(seededMessageSource(event)))).toHaveLength(0)
    } finally {
      await handle.dispose()
    }
  })
})
