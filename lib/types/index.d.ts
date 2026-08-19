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
 * @module @wm-coder/dsh-custom-first-control-prompt
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { HistoryPair } from './seed.ts';
import { PanelService } from './panel.ts';
export * from './seed.ts';
/** Cordis plugin name, also the plugin attribution on the injected messages. */
export declare const name = "custom-first-control-prompt";
/**
 * Required services: the system-prompt registry for sections, plus `llm`
 * (request redispatch) and `sessions` (subagent-origin filtering) for the
 * request-path seed injection.
 */
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
/** Plugin configuration; see README for the full contract. */
export interface Config {
    /** Ordered system-prompt fragments; absent or empty registers nothing. */
    sections?: SectionEntry[];
    /** Reference exchanges injected ahead of every conversation request; absent or empty injects nothing. */
    history?: HistoryPair[];
    /** `false` skips sessions whose header marks subagent origin. */
    includeSubagents?: boolean;
}
/** Cordis config schema; semantic checks beyond the schema run in {@link apply}. */
export declare const Config: z<Config>;
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
export declare function apply(ctx: Context, config: Config): void;
/**
 * No default export: the Loader's `unwrapExports` collapses a module with a
 * default export onto `exports.default` (`exports.default ?? exports`), which
 * would drop the named `Config` schema (and every other named export). Keep
 * `name`, `inject`, `Config`, and `apply` as named exports so the full plugin
 * object — schema included — survives the load path.
 */
//# sourceMappingURL=index.d.ts.map