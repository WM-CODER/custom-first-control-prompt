/**
 * Runtime-invariant companion for `@deepseek-ai/dsh-custom-first-control-prompt`:
 * asserts the package-owned seeded-message shape — every user or assistant
 * message this plugin seeds carries exactly one text block that is either the
 * documented transcript frame or plain conversational seed text.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt/invariant
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import {
  SEED_SOURCE,
  TRANSCRIPT_FRAME_CLOSE,
  TRANSCRIPT_FRAME_INTRO,
  TRANSCRIPT_FRAME_OPEN,
  TRANSCRIPT_RESERVED_TAGS,
} from './seed.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-custom-first-control-prompt'

/** Cordis plugin name of this invariant companion. */
export const name = 'custom-first-control-prompt-invariant'

/** Required service: the invariant registry. */
export const inject = ['invariants']

/** Escape every regexp metacharacter so fixed frame lines anchor the grammar. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const EXCHANGE = '<exchange>\\n<user>[\\s\\S]*?</user>\\n<assistant>[\\s\\S]*?</assistant>\\n</exchange>\\n'

/** Full grammar of the transcript frame produced by `renderTranscript`. */
const TRANSCRIPT_GRAMMAR = new RegExp(
  `^${escapeRegExp(TRANSCRIPT_FRAME_OPEN)}\\n${escapeRegExp(TRANSCRIPT_FRAME_INTRO)}\\n(?:${EXCHANGE})+${escapeRegExp(TRANSCRIPT_FRAME_CLOSE)}$`,
)

/** Whether the event is a message seeded by this plugin (frame or conversational seed). */
function isSeededMessage(event: SessionEvent): event is SessionEvent<'user/message' | 'assistant/message'> {
  if (event.type !== 'user/message' && event.type !== 'assistant/message') return false
  const message = event.type === 'user/message' ? event.data : event.data.message
  return message.source.kind === 'plugin'
    && message.source.plugin === SEED_SOURCE
}

/** A seeded message carries exactly one text block: the documented frame, or plain conversational text. */
function validateSeededMessage(event: SessionEvent<'user/message' | 'assistant/message'>, fail: InvariantFailure): void {
  const content = event.type === 'user/message' ? event.data.content : event.data.message.content
  const [block, ...rest] = content
  if (rest.length > 0 || block === undefined || block.type !== 'text') {
    fail('seeded message must carry exactly one text block')
  }
  const framed = TRANSCRIPT_GRAMMAR.test(block.text)
  const plain = !TRANSCRIPT_RESERVED_TAGS.some(tag => block.text.toLowerCase().includes(tag))
  if (!framed && !plain) {
    fail('seeded message text matches neither the <custom-history> frame grammar nor plain conversational seed rules')
  }
}

/** Replay validation of a durable log. */
function validateSession(session: Session, fail: InvariantFailure): void {
  for (const event of session.events) {
    if (isSeededMessage(event)) validateSeededMessage(event, fail)
  }
}

/* jscpd:ignore-start -- package companions share replay and dispatch plumbing */
/** Install validation for loaded and newly appended seeded messages. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  for (const session of ctx.sessions.list()) validateSession(session, fail)
  ctx.on('session/created', (session) => { validateSession(session, fail) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [, event] = args as [Session, SessionEvent]
    if (isSeededMessage(event)) validateSeededMessage(event, fail)
  }, { global: true })
}, { inject: ['sessions'] })
/* jscpd:ignore-end */

/**
 * Register the custom-first-control-prompt invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
