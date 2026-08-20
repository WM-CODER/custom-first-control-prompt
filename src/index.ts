/**
 * Deployment-configured prompt prefix. Ordered system-prompt sections render
 * ahead of the deployment persona, and configured reference user/assistant
 * exchanges are injected into every ordinary conversation request as real
 * alternating messages: the `llm/stream` waterfall clones the request with
 * the prebuilt seed sequence prepended and redispatches it. Nothing is
 * written to the session log, so real turn numbering is untouched, forking
 * stays clean, and compaction cannot shadow the reference history. Static
 * content renders byte-identically on every request, preserving prefix-cache
 * reuse.
 *
 * @module @wm-coders/dsh-custom-first-control-prompt
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { HistoryPair } from './seed.ts'
import { buildSeedMessages, TRANSCRIPT_RESERVED_TAGS } from './seed.ts'
import { PanelService } from './panel.ts'

export * from './seed.ts'

/** Cordis plugin name, also the plugin attribution on the injected messages. */
export const name = 'custom-first-control-prompt'

/**
 * Required services: the system-prompt registry for sections, plus `llm`
 * (request redispatch) and `sessions` (subagent-origin filtering) for the
 * request-path seed injection.
 */
export const inject = ['systemPrompt', 'llm', 'sessions']

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Web panel management service: patch editing, request capture, previews. */
    'custom-first-control-prompt-panel': PanelService
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

/** Plugin configuration; see README for the full contract. */
export interface Config {
  /** Ordered system-prompt fragments; absent or empty registers nothing. */
  sections?: SectionEntry[]
  /** Reference exchanges injected ahead of every conversation request; absent or empty injects nothing. */
  history?: HistoryPair[]
  /** `false` skips sessions whose header marks subagent origin. */
  includeSubagents?: boolean
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
      return `${field} text embeds reserved tag "${tag}"`
    }
  }
  return undefined
}

/**
 * Partition configured history pairs into usable pairs and per-pair problems.
 * Same degrade-instead-of-fail contract as {@link partitionSections}: an empty
 * side or an embedded reserved exchange tag is skipped with a warning, so a
 * bad pair never fails the plugin.
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
 * Register configured sections and install the request-path seed injection:
 * a `llm/stream` waterfall listener that clones every ordinary conversation
 * request with the prebuilt alternating seed messages prepended and
 * redispatches it through `ctx.llm.stream`.
 *
 * Loop-built requests are deep-frozen and marker-tagged
 * (`markAgentLoopRequest`), and the agent-loop invariant fails any marked
 * request whose messages differ from `deriveMessages()` — so the original
 * request object is never mutated. The clone carries no loop marker, the
 * invariant does not apply to it, and the discarded original is a pure
 * `deriveMessages()` projection (nothing unrecoverable is dropped). The seed
 * messages never enter the session log: real turn numbering is untouched,
 * forks stay ordinary copies, and compaction cannot shadow the reference
 * history because it is re-injected on every request.
 * @param ctx - plugin context.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  // The web panel service stays available even with no configured content:
  // it manages the patch entry and captures requests for the browser half.
  // The composed-config snapshot lets the panel show the bundle-layer defaults
  // while the profile patch still carries no row.
  new PanelService(ctx, {
    found: false,
    sections: (config.sections ?? []).map(section => ({
      name: section.name,
      order: section.order,
      text: section.text,
      enabled: section.enabled !== false,
    })),
    history: (config.history ?? []).map(pair => ({ user: pair.user, assistant: pair.assistant })),
    includeSubagents: config.includeSubagents === true,
  })
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
}

/**
 * No default export: the Loader's `unwrapExports` collapses a module with a
 * default export onto `exports.default` (`exports.default ?? exports`), which
 * would drop the named `Config` schema (and every other named export). Keep
 * `name`, `inject`, `Config`, and `apply` as named exports so the full plugin
 * object — schema included — survives the load path.
 */
