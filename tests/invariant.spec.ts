import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as Companion from '@deepseek-ai/dsh-custom-first-control-prompt/invariant'
import { renderTranscript, SEED_SOURCE } from '../src/seed.ts'

const VALID_TRANSCRIPT = renderTranscript([{ user: 'u', assistant: 'a' }])

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(InvariantRegistry, { enabled: true })
  await ctx.plugin(Companion)
  return ctx
}

function userEvent(text: string, plugin = SEED_SOURCE, content?: ContentBlock[]): SessionEvent<'user/message'> {
  return {
    type: 'user/message',
    seq: 0,
    time: 0,
    data: createUserMessage({
      content: content ?? [{ type: 'text', text }],
      source: { kind: 'plugin', plugin },
    }),
  }
}

describe('custom-first-control-prompt invariants', () => {
  it('exposes the companion plugin contract', () => {
    expect(Companion.name).toBe('custom-first-control-prompt-invariant')
    expect(Companion.inject).toEqual(['invariants'])
    expect(typeof Companion.apply).toBe('function')
  })

  it('accepts a seeded message matching the documented frame grammar', async () => {
    const ctx = await setup()
    const session = Session.create(SessionId('invariant-ok'))
    expect(() => { ctx.emit('session/event', session, userEvent(VALID_TRANSCRIPT)) }).not.toThrow()
  })

  it('rejects a seeded message that opens the frame but breaks the grammar', async () => {
    const ctx = await setup()
    const session = Session.create(SessionId('invariant-bad-grammar'))
    expect(() => {
      ctx.emit('session/event', session, userEvent(VALID_TRANSCRIPT.replace('</custom-history>', '')))
    }).toThrow(/matches neither/)
    expect(() => {
      ctx.emit('session/event', session, userEvent(VALID_TRANSCRIPT.replace('<exchange>', '')))
    }).toThrow(/matches neither/)
  })

  it('accepts plain conversational seed text without frame tags', async () => {
    const ctx = await setup()
    const session = Session.create(SessionId('invariant-plain-seed'))
    expect(() => {
      ctx.emit('session/event', session, userEvent('frameless seeded text'))
    }).not.toThrow()
  })

  it('rejects a seeded message without exactly one text block', async () => {
    const ctx = await setup()
    const session = Session.create(SessionId('invariant-bad-blocks'))
    expect(() => {
      ctx.emit('session/event', session, userEvent('', SEED_SOURCE, [
        { type: 'text', text: VALID_TRANSCRIPT },
        { type: 'text', text: 'extra' },
      ]))
    }).toThrow(/exactly one text block/)
    expect(() => {
      ctx.emit('session/event', session, userEvent('', SEED_SOURCE, [
        { type: 'image' } as unknown as ContentBlock,
      ]))
    }).toThrow(/exactly one text block/)
    expect(() => {
      ctx.emit('session/event', session, userEvent('', SEED_SOURCE, []))
    }).toThrow(/exactly one text block/)
  })

  it('ignores messages from other plugins and non-plugin sources', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('invariant-ordinary'))
    expect(() => {
      ctx.emit('session/event', session, userEvent(VALID_TRANSCRIPT, 'other-plugin'))
    }).not.toThrow()
    // Store-bound appends dispatch through the listener without a violation.
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'hi' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
  })

  it('accepts a valid seeded log present before late registration', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('invariant-late-valid'))
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'ordinary user text' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: VALID_TRANSCRIPT }],
      source: { kind: 'plugin', plugin: SEED_SOURCE },
    }), { surfaceOp: 'append' })
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(Companion)).resolves.toBeDefined()
  })

  it('rejects an invalid seeded log on late registration', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('invariant-late-invalid'))
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: '<custom-history>broken frame' }],
      source: { kind: 'plugin', plugin: SEED_SOURCE },
    }), { surfaceOp: 'append' })
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(Companion)).rejects.toThrow(/matches neither/)
  })
})
