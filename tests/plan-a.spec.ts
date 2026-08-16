import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as CustomFirstControlPrompt from '@deepseek-ai/dsh-custom-first-control-prompt'
import * as Companion from '@deepseek-ai/dsh-custom-first-control-prompt/invariant'
import { appendSeedTurns, buildSeedEvents, hasSeededHistory, SEED_SOURCE } from '../src/seed.ts'

const PAIRS = [
  { user: '用户测试提示词1', assistant: '助手提示词1' },
  { user: '用户测试提示词2', assistant: '助手提示词2' },
]

/** Minimal agent facade for emitting agent/session-start at a session. */
function sessionAgent(session: Session): Agent {
  return {
    id: SessionId('route-b-agent'),
    options: {},
    session,
    inbox: undefined as never,
    status: 'running',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

describe('Plan A: conversational reference-history seeding', () => {
  it('contributes balanced seed turns through the agent-loop/session-seed waterfall', async () => {
    const ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(AgentLoop, { agents: [] })
    ctx.on('agent-loop/session-seed', async (_payload, next) => {
      const base = await next()
      return [...base, ...buildSeedEvents([{ user: 'probe user', assistant: 'probe assistant' }], base.length, 1)]
    })
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('plan-a-hook'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      const events = handle.agent.session.events
      expect(events.map(event => event.type)).toEqual([
        'turn/start', 'step/start', 'user/message', 'assistant/message', 'step/end', 'turn/end', 'session/end-seed',
      ])
      const turnStart = events.find(event => event.type === 'turn/start')
      expect(turnStart?.data.turn).toBe(1)
      const user = events.find(event => event.type === 'user/message')
      expect(user?.data.source).toEqual({ kind: 'user' })
      const assistant = events.find(event => event.type === 'assistant/message')
      expect(assistant?.data.message.role).toBe('assistant')
      expect(assistant?.data.message.source).toEqual({ kind: 'plugin', plugin: SEED_SOURCE })
    } finally {
      await handle.dispose()
    }
  })

  it('accepts plugin-sourced assistant seeds but still rejects model-sourced ones without provider/model', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    expect(() => ctx.sessions.create(SessionId('plan-a-seed'), {
      seed: buildSeedEvents(PAIRS, 0, 1),
    })).not.toThrow()
    const bad = buildSeedEvents(PAIRS, 0, 1)
    const assistantEvent = bad.find(event => event.type === 'assistant/message')
    if (assistantEvent === undefined) throw new Error('missing assistant/message seed event')
    ;(assistantEvent as { data: { message: { source: unknown } } }).data.message.source = { kind: 'model' }
    expect(() => ctx.sessions.create(SessionId('plan-a-seed-bad'), { seed: bad }))
      .toThrow(/model source with provider\/model/)
  })

  it('seeds configured pairs as conversational turns with real user/assistant roles, once', async () => {
    const ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await ctx.plugin(Companion)
    await ctx.plugin(CustomFirstControlPrompt, {
      history: PAIRS,
      reapplyAfterCompaction: false,
    })
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('plan-a-e2e'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      const session = handle.agent.session
      expect(session.events.map(event => event.type)).toEqual([
        'turn/start', 'step/start', 'user/message', 'assistant/message', 'step/end', 'turn/end',
        'turn/start', 'step/start', 'user/message', 'assistant/message', 'step/end', 'turn/end',
        'session/end-seed',
      ])
      expect(session.events.filter(event => event.type === 'turn/start').map(event => event.data.turn))
        .toEqual([1, 2])
      expect(session.deriveMessages().map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
      // The session-start frame fallback must not duplicate the conversational
      // seed: the seed's marker rides the plugin-attributed assistant side, and
      // the conversational user side is a plain user message — so the log holds
      // no framed plugin user message on top of the two seeded turns.
      expect(hasSeededHistory(session)).toBe(true)
      expect(session.events.filter(event => event.type === 'user/message'
        && event.data.source.kind === 'plugin')).toHaveLength(0)
    } finally {
      await handle.dispose()
    }
  })

  it('route B: appendSeedTurns writes balanced closed turns with real roles', async () => {
    const ctx = new Context()
    // No AgentLoop, no hook: this is the plain Session.append() path.
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('route-b-append'))
    appendSeedTurns(session, PAIRS)
    expect(session.events.map(event => event.type)).toEqual([
      'turn/start', 'step/start', 'user/message', 'assistant/message', 'step/end', 'turn/end',
      'turn/start', 'step/start', 'user/message', 'assistant/message', 'step/end', 'turn/end',
    ])
    expect(session.events.filter(event => event.type === 'turn/start').map(event => event.data.turn))
      .toEqual([1, 2])
    const users = session.events.filter(event => event.type === 'user/message')
    for (const user of users) expect(user.data.source).toEqual({ kind: 'user' })
    const assistants = session.events.filter(event => event.type === 'assistant/message')
    for (const assistant of assistants) {
      expect(assistant.data.message.role).toBe('assistant')
      expect(assistant.data.message.source).toEqual({ kind: 'plugin', plugin: SEED_SOURCE })
      expect(assistant.data.turn).toBeTypeOf('number')
      expect(assistant.data.step).toBe(1)
    }
    expect(session.deriveMessages().map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(hasSeededHistory(session)).toBe(true)
  })

  it('route B: seedMode append injects at session-start only, ignores the hook, and never duplicates', async () => {
    const ctx = new Context()
    // A hook-capable framework is mounted, but seedMode 'append' must not use it:
    // the plugin registers no session-seed listener, so the conversational
    // turns arrive via agent/session-start append — with no session/end-seed
    // boundary marker (the hook path adds one).
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await ctx.plugin(Companion)
    await ctx.plugin(CustomFirstControlPrompt, { history: PAIRS, seedMode: 'append' })
    const handle = await ctx.agentLoop.createAgent(ctx, {
      sessionId: SessionId('route-b-session'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    try {
      const session = handle.agent.session
      // createAgent publishes → agent/session-start fired → append seeded the log.
      expect(session.events.map(event => event.type)).toEqual([
        'turn/start', 'step/start', 'user/message', 'assistant/message', 'step/end', 'turn/end',
        'turn/start', 'step/start', 'user/message', 'assistant/message', 'step/end', 'turn/end',
      ])
      // No hook boundary marker: proves the seed came from append, not the hook.
      expect(session.events.some(event => event.type === 'session/end-seed')).toBe(false)
      expect(hasSeededHistory(session)).toBe(true)
      // Resume (or a second session-start) must not re-seed.
      agentEvents(ctx, sessionAgent(session)).emit('agent/session-start', { source: 'resume' })
      expect(session.events).toHaveLength(12)
    } finally {
      await handle.dispose()
    }
  })
})
