/**
 * Deployment-configured prompt prefix. Ordered system-prompt sections render
 * ahead of the deployment persona, and configured reference user/assistant
 * exchanges are seeded into the session log once, before the first turn.
 * Static content renders byte-identically on every request, preserving
 * prefix-cache reuse.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-loop'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { HistoryPair } from './seed.ts'
import { appendSeedTurns, buildHistoryMessage, buildSeedEvents, buildSeedMessages, hasSeededHistory, isSeededByPlugin, seededMessageSource, seedTranscript, TRANSCRIPT_RESERVED_TAGS } from './seed.ts'
import { PanelService } from './panel.ts'

/** Cordis plugin name, also the plugin attribution on the seeded message. */
export const name = 'custom-first-control-prompt'

/**
 * Required services: the agent registry for session lifecycle events, the
 * system-prompt registry for sections, plus `llm` (request redispatch) and
 * `sessions` (subagent-origin filtering) for the `intercept` seed mode.
 */
export const inject = ['agents', 'systemPrompt', 'llm', 'sessions']

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Web panel management service: patch editing, request capture, previews. */
    'custom-first-control-prompt-panel': PanelService
  }
}

// The `agent-loop/session-seed` waterfall exists only on hook-capable
// framework builds (patches/framework-planA*.patch); stock 0.1.x frameworks
// declare no such event. This local declaration lets the hook branch
// typecheck against either build: where the framework also declares it, the
// identical signature merges as a harmless duplicate overload. Delete this
// shim once the framework merges the hook upstream.
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Contribute durable seed events before a session is prepared. Listeners
     * receive the identity and creation metadata of the session about to be
     * created and the seed accumulated so far; call `next()` to reach
     * downstream contributions plus the caller-supplied seed, then return the
     * complete seed list. Contributed events must form balanced, fully closed
     * turns contiguously numbered from the accumulated seed.
     * @param payload.sessionId - identity of the session being created.
     * @param payload.meta - creation metadata; mirrors `CreateAgentOptions.meta`
     *   (cwd, fork lineage, origin, delegation budget, preset).
     * @param next - downstream contributions plus the caller-supplied seed.
     * @returns the complete seed event list the factory passes to the session boundary.
     * @mode waterfall
     */
    'agent-loop/session-seed'(
      payload: {
        sessionId: SessionId
        meta: Readonly<{
          cwd?: string
          parentSession?: SessionId
          seedLength?: number
          origin?: 'subagent'
          delegationDepth?: number
          agentPreset?: string
        }> | undefined
      },
      next: () => Promise<readonly SessionEvent[]>,
    ): Promise<readonly SessionEvent[]>
  }
}

/** One named system-prompt fragment contributed among the shipped sections. */
export interface SectionEntry {
  /** Entry name; the registry sees `custom-first-control-prompt:<name>`. */
  name: string
  /** Render position among all sections; values below 0 prepend ahead of the persona. */
  order: number
  /** `false` keeps the entry in configuration without registering it. */
  enabled?: boolean
  /** Static section text; keep it free of volatile values such as timestamps. */
  text: string
}

/**
 * When the reference history is applied relative to a conversation's lifecycle.
 * - `session-start`: seed the exchanges durably once when the session begins;
 *   cheapest, but compaction may shadow them from derived history.
 * - `reapply`: re-apply on demand — the pre-step listener injects the frame
 *   only when the request's messages carry none from this plugin, so the
 *   reference history is restored right after compaction shadows it. Fixed
 *   one-copy cost per request, compaction-immune. Recommended default.
 * - `per-request`: re-inject the frame as the first user message of every
 *   model request (each frame is logged with the step); the most aggressive,
 *   at a per-turn accumulation cost until compaction absorbs earlier frames.
 */
export type HistoryMode = 'session-start' | 'reapply' | 'per-request'

/**
 * Which mechanism injects the conversational (Plan A) reference seed.
 * - `append` (default, route B): the reference exchanges are appended as
 *   balanced conversational turns at `agent/session-start` via `Session.append()`
 *   — no framework hook or patch needed, works on any 0.1.x framework (npm
 *   0.1.x included). `historyMode` is ignored in this mode (session-start-only
 *   injection by design); `reapply`/`per-request` compaction fallbacks do not
 *   apply. Known limitation: forking a session that carries an append-seeded
 *   conversation fails on frameworks without the seed-boundary relaxation
 *   (the fork prefix re-enters the seed boundary, which rejects plugin-source
 *   assistant messages). Route B also collides with the loop's turn numbering
 *   on unpatched frameworks: the agent reads its last-turn watermark before
 *   `agent/session-start` fires, so the first real turn reuses a seeded turn
 *   number and the surface fold lets the real assistant message shadow the
 *   seeded one — prefer `intercept` on npm builds.
 * - `hook` (route A): the `agent-loop/session-seed` waterfall at session
 *   creation, seeded through the `sessions.prepare` boundary — requires the
 *   framework hook (mainline builds only) and keeps seed-boundary forking.
 * - `intercept` (route C): the `llm/stream` waterfall clones every ordinary
 *   conversation request and redispatches it with the reference exchanges
 *   prepended as real alternating user/assistant messages. Nothing is written
 *   to the session log, so there is no turn conflict, no seed-boundary or
 *   fork restriction, and compaction immunity by construction. Works on any
 *   0.1.x framework without a patch. Trade-offs: the reference history is
 *   invisible in the chat transcript (it lives only on the request path),
 *   each request carries one fixed copy (same cost as one seed, but on every
 *   request), and model-visible reconstruction reads the session log plus the
 *   deployment configuration (`cordis.patch.yml`) — the log alone does not
 *   carry the injected pairs, because this framework has no registration
 *   surface for plugin-owned session event types. `historyMode` is ignored
 *   (no log state exists to reapply).
 */
export type SeedMode = 'hook' | 'append' | 'intercept'

/** Plugin configuration; see README for the full contract. */
export interface Config {
  /** Ordered system-prompt fragments; absent or empty registers nothing. */
  sections?: SectionEntry[]
  /** Reference exchanges seeded before the first turn; absent or empty seeds nothing. */
  history?: HistoryPair[]
  /** `false` skips sessions whose header marks subagent origin. */
  includeSubagents?: boolean
  /**
   * Reference-history application mode; see {@link HistoryMode}. Defaults to
   * `reapply` (compaction-immune, fixed one-copy cost).
   */
  historyMode?: HistoryMode
  /**
   * Conversational-seed mechanism: `append` (default, route B), `hook`
   * (route A, framework `agent-loop/session-seed` seed boundary), or
   * `intercept` (route C, request-level injection through `llm/stream`;
   * recommended on npm 0.1.x). See {@link SeedMode}.
   */
  seedMode?: SeedMode
  /**
   * Legacy alias. `true` maps to `historyMode: 'reapply'`, `false` maps to
   * `'session-start'`; an explicit `historyMode` wins.
   */
  reapplyAfterCompaction?: boolean
}

/** Cordis config schema; semantic checks beyond the schema run in {@link apply}. */
export const Config: z<Config> = z.object({
  sections: z.array(z.object({
    name: z.string().required(),
    order: z.number().required(),
    enabled: z.boolean().default(true),
    text: z.string().required(),
  })).default([]),
  history: z.array(z.object({
    user: z.string().required(),
    assistant: z.string().required(),
  })),
  includeSubagents: z.boolean().default(false),
  historyMode: z.union(['session-start', 'reapply', 'per-request']),
  seedMode: z.union(['hook', 'append', 'intercept']),
  reapplyAfterCompaction: z.boolean(),
})

/**
 * Partition configured sections into mountable entries and per-entry problems.
 * A blank name, a duplicate name (first wins), a non-finite order, or an empty
 * text is reported and skipped: the configuration is deployment-editable, so a
 * bad entry must degrade to "not injected", never fail the plugin tree and take
 * the whole deployment down with it.
 * @param sections - configured section entries.
 * @returns the mountable entries and the human-readable problems for the rest.
 */
function partitionSections(sections: readonly SectionEntry[]): { clean: SectionEntry[]; problems: string[] } {
  const clean: SectionEntry[] = []
  const problems: string[] = []
  const seen = new Set<string>()
  for (const [index, section] of sections.entries()) {
    if (section.name.trim() === '') {
      problems.push(`sections[${index}].name is blank`)
      continue
    }
    if (seen.has(section.name)) {
      problems.push(`sections[${index}] reuses name "${section.name}" (first entry wins)`)
      continue
    }
    seen.add(section.name)
    if (!Number.isFinite(section.order)) {
      problems.push(`sections[${index}].order for "${section.name}" is not a finite number`)
      continue
    }
    if (section.text.length === 0) {
      problems.push(`sections[${index}].text for "${section.name}" is empty`)
      continue
    }
    clean.push(section)
  }
  return { clean, problems }
}

/**
 * Describe why one reference-history pair must be skipped, or no value when the
 * pair is usable.
 * @param pair - a configured reference exchange.
 * @returns the problem description, or no value when the pair is usable.
 */
function pairProblem(pair: HistoryPair): string | undefined {
  for (const [field, text] of [['user', pair.user], ['assistant', pair.assistant]] as const) {
    if (text.length === 0) {
      return `${field} text is empty`
    }
    const lower = text.toLowerCase()
    const tag = TRANSCRIPT_RESERVED_TAGS.find(reserved => lower.includes(reserved))
    if (tag !== undefined) {
      return `${field} text embeds reserved frame tag "${tag}"`
    }
  }
  return undefined
}

/**
 * Partition configured history pairs into usable pairs and per-pair problems.
 * Same degrade-instead-of-fail contract as {@link partitionSections}: an empty
 * side or an embedded reserved frame tag is skipped with a warning, so a bad
 * pair never fails the plugin. Skipping instead of seeding keeps the frame
 * tags it would have broken out of the log.
 * @param pairs - configured reference exchanges.
 * @returns the usable pairs and the human-readable problems for the rest.
 */
function partitionPairs(pairs: readonly HistoryPair[]): { clean: HistoryPair[]; problems: string[] } {
  const clean: HistoryPair[] = []
  const problems: string[] = []
  for (const [index, pair] of pairs.entries()) {
    const problem = pairProblem(pair)
    if (problem === undefined) {
      clean.push(pair)
    } else {
      problems.push(`history[${index}] ${problem}`)
    }
  }
  return { clean, problems }
}

/**
 * Register configured sections and install the history application strategy
 * selected by {@link Config.historyMode}.
 *
 * - `session-start`: one durable `agent/session-start` seed, scanning the log
 *   for an earlier injection so resume and fork never duplicate it.
 * - `reapply` (default): a `agent/pre-step` listener injects the framed
 *   transcript only when the request's messages carry no frame from this
 *   plugin — the reference history therefore stays present through compaction
 *   (restored on the next request after being shadowed) at a fixed one-copy
 *   cost, and configuration changes apply to the very next request.
 * - `per-request`: the same listener always prepends a fresh frame, logging
 *   one copy per step until compaction absorbs the earlier frames.
 * @param ctx - plugin context.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  // The web panel service stays available even with no configured content:
  // it manages the patch entry and captures requests for the browser half.
  new PanelService(ctx)
  const sections = config.sections ?? []
  const { clean: mountableSections, problems: sectionProblems } = partitionSections(sections)
  for (const problem of sectionProblems) ctx.logger.warn('skipping a configured section: %s', problem)
  for (const section of mountableSections) {
    if (section.enabled === false) continue
    ctx.effect(() => ctx.systemPrompt.section({
      name: `${name}:${section.name}`,
      order: section.order,
      text: section.text,
    }), `${name}.section(${section.name})`)
  }
  const history = config.history
  if (history === undefined || history.length === 0) return
  const { clean: pairs, problems: pairProblems } = partitionPairs(history)
  for (const problem of pairProblems) ctx.logger.warn('skipping a configured reference-history pair: %s', problem)
  if (pairs.length === 0) return
  // Route B (seedMode 'append'): session-start-only conversational injection
  // through Session.append() — no framework hook, no pre-step frames, and
  // historyMode is deliberately ignored (one-shot at session start by design).
  // Fully isolated from route A: this branch returns before any hook listener
  // or pre-step listener is registered, so a deployment toggling the switch
  // never double-injects, and reverting to the default ('hook') on restart
  // restores the exact route-A behavior.
  // Route B (append) is the default mechanism: Session.append() needs no
  // framework hook or patch, so the conversational tier works on npm 0.1.x out
  // of the box; an explicit 'hook' opts back into the framework seed boundary.
  const seedMode: SeedMode = config.seedMode ?? 'append'
  // Route C (intercept): clone-and-redispatch at the llm/stream waterfall.
  // Loop-built requests are deep-frozen and marker-tagged
  // (`markAgentLoopRequest`), and the agent-loop invariant fails any marked
  // request whose messages differ from `deriveMessages()` — so the original
  // request object is never mutated. Instead the listener clones it with the
  // reference exchanges prepended and redispatches through `ctx.llm.stream`:
  // the clone carries no loop marker, the invariant does not apply to it, and
  // the discarded original is a pure `deriveMessages()` projection (nothing
  // unrecoverable is dropped). Fully isolated from the append/hook branches:
  // this branch returns before any session-start, session-seed, or pre-step
  // listener is registered, so toggling modes never double-injects, and
  // `historyMode` is intentionally ignored (no log state exists to reapply).
  if (seedMode === 'intercept') {
    const seedMessages = buildSeedMessages(pairs)
    // Reentry guard: the redispatched clone re-enters this waterfall; the
    // WeakSet marks it so it passes straight through instead of being
    // intercepted recursively. Keyed by request object identity — no teardown
    // bookkeeping, and entries vanish with the request.
    const reentry = new WeakSet<GenerateOptions>()
    ctx.on('llm/stream', (options, next) => {
      if (reentry.has(options)) {
        reentry.delete(options)
        return next()
      }
      // Ordinary conversation requests only: auxiliary calls (compaction,
      // session-title) carry `purpose`; hand-built calls carry no `sessionId`.
      if (options.purpose !== undefined) return next()
      const sessionId = options.sessionId
      if (sessionId === undefined) return next()
      if (config.includeSubagents !== true
        && ctx.sessions.get(sessionId)?.header.origin === 'subagent') return next()
      const cloned: GenerateOptions = { ...options, messages: [...seedMessages, ...options.messages] }
      reentry.add(cloned)
      return ctx.llm.stream(cloned)
    }, { prepend: true })
    return
  }
  if (seedMode === 'append') {
    ctx.on('agent/session-start', ({ agent }) => {
      if (config.includeSubagents !== true && agent.session.header.origin === 'subagent') return
      if (hasSeededHistory(agent.session)) return
      appendSeedTurns(agent.session, pairs)
    })
    return
  }
  // Plan A conversational seed: contribute one balanced turn per pair at
  // session creation, so the model sees real user/assistant exchanges instead
  // of one framed transcript. Skipped when the accumulated seed is non-empty
  // (a fork already carries the reference history) and for subagent-originated
  // sessions unless the deployment opted them in.
  ctx.on('agent-loop/session-seed', async (payload, next) => {
    const base = await next()
    if (base.length > 0) return base
    if (config.includeSubagents !== true && payload.meta?.origin === 'subagent') return base
    return [...base, ...buildSeedEvents(pairs, base.length, 1)]
  })
  const mode: HistoryMode = config.historyMode ?? (
    config.reapplyAfterCompaction === true ? 'reapply'
      : config.reapplyAfterCompaction === false ? 'session-start'
        : 'reapply')
  if (mode === 'session-start') {
    ctx.on('agent/session-start', ({ agent }) => {
      if (config.includeSubagents !== true && agent.session.header.origin === 'subagent') return
      if (hasSeededHistory(agent.session)) return
      seedTranscript(agent.session, pairs)
    })
    return
  }
  const reapply = mode === 'reapply'

  // Seq of the newest frame this plugin has durably logged for the agent, and
  // the shadow boundary of the latest compaction. A frame whose seq lies past
  // the boundary still reaches derived history; one at/below it was shadowed.
  // The marker covers both seed shapes: the conversational seed's user side is
  // a plain user message, so its plugin-attributed assistant side stands in
  // for it (same contiguous event range, same seq semantics).
  const latestSeededSeq = (agent: { session: { events: readonly unknown[] } }): number => {
    let seq = -1
    for (const event of agent.session.events) {
      if (event && typeof (event as { seq?: number }).seq === 'number'
        && isSeededByPlugin(seededMessageSource(event as SessionEvent))) {
        const eventSeq = (event as { seq: number }).seq
        if (eventSeq > seq) seq = eventSeq
      }
    }
    return seq
  }
  const latestShadowEnd = (agent: { session: { events: readonly unknown[] } }): number => {
    let end = -1
    for (const event of agent.session.events) {
      if (event && (event as { type?: string }).type === 'compaction/summary') {
        const range = (event as { data?: { shadowedRange?: { end?: unknown } } }).data?.shadowedRange
        if (range && typeof range.end === 'number' && range.end > end) end = range.end
      }
    }
    return end
  }

  ctx.on('agent/pre-step', async ({ agent }, next) => {
    if (config.includeSubagents !== true && agent.session.header.origin === 'subagent') return next()
    const decision = await next()
    if (decision.kind === 'reject') return decision
    if (reapply && latestSeededSeq(agent) > latestShadowEnd(agent)) {
      // An unshadowed frame already reaches derived history; keep it at one copy.
      return decision
    }
    return {
      kind: 'enter',
      messages: [buildHistoryMessage(pairs), ...decision.messages],
    }
  }, { prepend: true })
}

/**
 * No default export: the Loader's `unwrapExports` collapses a module with a
 * default export onto `exports.default` (`exports.default ?? exports`), which
 * would drop the named `Config` schema (and every other named export). Keep
 * `name`, `inject`, `Config`, and `apply` as named exports so the full plugin
 * object — schema included — survives the load path.
 */
