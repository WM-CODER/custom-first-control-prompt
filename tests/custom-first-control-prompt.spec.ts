import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage, LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { PERSONA_ORDER } from '@deepseek-ai/dsh-system-prompt'
import * as App from '@deepseek-ai/dsh-custom-first-control-prompt'

/**
 * The plugin-under-test mount used by the section tests: one context with the
 * standard test dependencies, the plugin mounted with a validated config, no
 * LLM requests.
 */
async function harnessMount(config: Record<string, unknown>): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(App, config as never)
  return ctx
}

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

/** Mount the standard stack plus the plugin under test, ready for one turn. */
async function loopMount(adapter: CaptureAdapter, config: Record<string, unknown>): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  ctx.llm.registerAdapter(['mock'], adapter)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(App, config as never)
  return ctx
}

/** Flatten a request's messages to their text payloads, for order assertions. */
function texts(options: GenerateOptions): string[] {
  return options.messages.map(message =>
    message.content.map(block => (block.type === 'text' ? block.text : '')).join(''))
}

describe('system sections', () => {
  it('registers sections under the plugin prefix and honors negative order ahead of the persona', async () => {
    const ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    ctx.systemPrompt.section({ name: 'test:persona-stand-in', order: PERSONA_ORDER, text: 'Persona body.' })
    await ctx.plugin(App, {
      sections: [
        { name: 'tail', order: 10, text: 'S_TAIL' },
        { name: 'head', order: -5, text: 'S_HEAD' },
      ],
    })
    const names = (await ctx.systemPrompt.assemble()).sections.map(section => section.name)
    expect(names.indexOf('custom-first-control-prompt:head')).toBeGreaterThanOrEqual(0)
    expect(names.indexOf('custom-first-control-prompt:head')).toBeLessThan(names.indexOf('test:persona-stand-in'))
    expect(names.indexOf('custom-first-control-prompt:head')).toBeLessThan(names.indexOf('custom-first-control-prompt:tail'))
  })

  it('skips disabled sections but keeps enabled ones', async () => {
    const ctx = await harnessMount({
      sections: [
        { name: 'off', order: 1, enabled: false, text: 'S_OFF' },
        { name: 'on', order: 2, text: 'S_ON' },
      ],
    })
    const names = (await ctx.systemPrompt.assemble()).sections.map(section => section.name)
    expect(names).not.toContain('custom-first-control-prompt:off')
    expect(names).toContain('custom-first-control-prompt:on')
  })
})

describe('configuration degradation', () => {
  it('skips malformed sections with per-entry warnings and mounts the rest', async () => {
    const ctx = await harnessMount({
      sections: [
        { name: 'ok', order: 1, text: 'S_OK' },
        { name: '', order: 2, text: 'S_BLANK_NAME' },
        { name: 'ok', order: 3, text: 'S_DUPLICATE_NAME' },
        { name: 'bad-order', order: Number.NaN, text: 'S_BAD_ORDER' },
        { name: 'empty', order: 4, text: '' },
      ],
    })
    const names = (await ctx.systemPrompt.assemble()).sections.map(section => section.name)
    expect(names).toContain('custom-first-control-prompt:ok')
    expect(names.some(name => name.startsWith('custom-first-control-prompt:') && name !== 'custom-first-control-prompt:ok')).toBe(false)
  })

  it('injects only usable pairs: empty sides and reserved-tag texts are skipped', async () => {
    const adapter = new CaptureAdapter([textChunks('fine')])
    const ctx = await loopMount(adapter, { history: [
      { user: 'U_OK', assistant: 'A_OK' },
      { user: '', assistant: 'A_EMPTY_USER' },
      { user: 'U_EMPTY_ASSISTANT', assistant: '' },
      { user: 'U_TAG <custom-history>x</custom-history>', assistant: 'A_TAG' },
    ] })
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('degrade-history'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'hello' }],
        source: { kind: 'user' },
      }))
      await handle.agent.whenIdle()
      expect(adapter.requests).toHaveLength(1)
      expect(texts(adapter.requests[0]!)).toEqual(['U_OK', 'A_OK', 'hello'])
    } finally {
      await handle.dispose()
    }
  })

  it('rejects malformed entries at the schema layer before degradation runs', async () => {
    const ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    const bad: unknown[] = [
      { sections: 'not-an-array' },
      { history: [{ user: 1, assistant: 2 }] },
      { sections: [{ order: 1, text: 'S' }] },
    ]
    for (const entry of bad) {
      await expect(ctx.plugin(App, entry as never)).rejects.toThrow()
    }
  })
})

describe('loader export path', () => {
  it('exports the plugin as a named bundle the Loader can consume', async () => {
    expect(App.name).toBe('custom-first-control-prompt')
    expect(App.inject).toEqual(['systemPrompt', 'llm', 'sessions'])
    expect(App.Config).toBeInstanceOf(z)
    expect(typeof App.apply).toBe('function')
    expect(typeof App.SEED_SOURCE).toBe('string')
    expect(typeof App.buildSeedMessages).toBe('function')
    // No session companion export: the request path writes no log events, so
    // there is nothing for a log invariant to validate.
    expect((App as Record<string, unknown>).Invariant).toBeUndefined()
    const ns = await import('@deepseek-ai/dsh-custom-first-control-prompt/client')
    expect(typeof ns).toBe('object')
  })
})
