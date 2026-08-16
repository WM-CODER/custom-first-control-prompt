/**
 * Deployment-configured prompt prefix. Ordered system-prompt sections render
 * ahead of the deployment persona, and configured reference user/assistant
 * exchanges are seeded into the session log once, before the first turn.
 * Static content renders byte-identically on every request, preserving
 * prefix-cache reuse.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { HistoryPair } from './seed.ts';
import { PanelService } from './panel.ts';
/** Cordis plugin name, also the plugin attribution on the seeded message. */
export declare const name = "custom-first-control-prompt";
/** Required services: the agent registry for session lifecycle events and the system-prompt registry for sections. */
export declare const inject: string[];
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Web panel management service: patch editing, request capture, previews. */
        'custom-first-control-prompt-panel': PanelService;
    }
}
/** One named system-prompt fragment contributed among the shipped sections. */
export interface SectionEntry {
    /** Entry name; the registry sees `custom-first-control-prompt:<name>`. */
    name: string;
    /** Render position among all sections; values below 0 prepend ahead of the persona. */
    order: number;
    /** `false` keeps the entry in configuration without registering it. */
    enabled?: boolean;
    /** Static section text; keep it free of volatile values such as timestamps. */
    text: string;
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
export type HistoryMode = 'session-start' | 'reapply' | 'per-request';
/**
 * Which mechanism injects the conversational (Plan A) reference seed.
 * - `hook` (default): the `agent-loop/session-seed` waterfall at session
 *   creation — requires the framework hook (mainline builds only).
 * - `append`: route B — no hook, no pre-step frames; the reference exchanges
 *   are appended as balanced conversational turns at `agent/session-start`
 *   only. Works on any 0.1.x framework (npm 0.1.x included) without patching
 *   the framework. `historyMode` is ignored in this mode (session-start-only
 *   injection by design); `reapply`/`per-request` compaction fallbacks do not
 *   apply. Known limitation: forking a session that carries an append-seeded
 *   conversation fails on frameworks without the seed-boundary relaxation
 *   (the fork prefix re-enters the seed boundary, which rejects plugin-source
 *   assistant messages).
 */
export type SeedMode = 'hook' | 'append';
/** Plugin configuration; see README for the full contract. */
export interface Config {
    /** Ordered system-prompt fragments; absent or empty registers nothing. */
    sections?: SectionEntry[];
    /** Reference exchanges seeded before the first turn; absent or empty seeds nothing. */
    history?: HistoryPair[];
    /** `false` skips sessions whose header marks subagent origin. */
    includeSubagents?: boolean;
    /**
     * Reference-history application mode; see {@link HistoryMode}. Defaults to
     * `reapply` (compaction-immune, fixed one-copy cost).
     */
    historyMode?: HistoryMode;
    /**
     * Conversational-seed mechanism: `hook` (framework `agent-loop/session-seed`,
     * default) or `append` (route B, session-start-only; see {@link SeedMode}).
     */
    seedMode?: SeedMode;
    /**
     * Legacy alias. `true` maps to `historyMode: 'reapply'`, `false` maps to
     * `'session-start'`; an explicit `historyMode` wins.
     */
    reapplyAfterCompaction?: boolean;
}
/** Cordis config schema; semantic checks beyond the schema run in {@link apply}. */
export declare const Config: z<Config>;
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
export declare function apply(ctx: Context, config: Config): void;
/**
 * No default export: the Loader's `unwrapExports` collapses a module with a
 * default export onto `exports.default` (`exports.default ?? exports`), which
 * would drop the named `Config` schema (and every other named export). Keep
 * `name`, `inject`, `Config`, and `apply` as named exports so the full plugin
 * object — schema included — survives the load path.
 */
//# sourceMappingURL=index.d.ts.map