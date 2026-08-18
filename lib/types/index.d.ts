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
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session';
import type { HistoryPair } from './seed.ts';
import { PanelService } from './panel.ts';
/** Cordis plugin name, also the plugin attribution on the seeded message. */
export declare const name = "custom-first-control-prompt";
/**
 * Required services: the agent registry for session lifecycle events, the
 * system-prompt registry for sections, plus `llm` (request redispatch) and
 * `sessions` (subagent-origin filtering) for the `intercept` seed mode.
 */
export declare const inject: string[];
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Web panel management service: patch editing, request capture, previews. */
        'custom-first-control-prompt-panel': PanelService;
    }
}
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
        'agent-loop/session-seed'(payload: {
            sessionId: SessionId;
            meta: Readonly<{
                cwd?: string;
                parentSession?: SessionId;
                seedLength?: number;
                origin?: 'subagent';
                delegationDepth?: number;
                agentPreset?: string;
            }> | undefined;
        }, next: () => Promise<readonly SessionEvent[]>): Promise<readonly SessionEvent[]>;
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
export type SeedMode = 'hook' | 'append' | 'intercept';
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
     * Conversational-seed mechanism: `append` (default, route B), `hook`
     * (route A, framework `agent-loop/session-seed` seed boundary), or
     * `intercept` (route C, request-level injection through `llm/stream`;
     * recommended on npm 0.1.x). See {@link SeedMode}.
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