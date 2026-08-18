import z from "@deepseek-ai/schemastery";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { Context } from "@deepseek-ai/cordis";
import { SessionEvent, SessionId } from "@deepseek-ai/dsh-session";
import { Agent } from "@deepseek-ai/dsh-agent";

//#region src/seed.d.ts
/** One configured reference exchange between a user and the assistant. */
interface HistoryPair {
  /** User-side text of the exchange. */
  user: string;
  /** Assistant-side text of the exchange. */
  assistant: string;
}
//#endregion
//#region src/panel-types.d.ts
/**
 * Wire types shared by the web panel's Host service and browser half. Every
 * value crosses the Typert Remote boundary and must stay lossless-JSON.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt/panel-types
 */
/** One configured system-prompt section as the panel shows it. */
interface PanelSectionView {
  /** Section name; the registry sees `custom-first-control-prompt:<name>`. */
  name: string;
  /** Render position among all sections. */
  order: number;
  /** `false` keeps the entry in configuration without registering it. */
  enabled: boolean;
  /** Static section text. */
  text: string;
}
/** One configured reference exchange as the panel shows it. */
interface PanelPairView {
  /** User-side text of the exchange. */
  user: string;
  /** Assistant-side text of the exchange. */
  assistant: string;
}
/** Parsed view of this plugin's entry inside the profile patch file. */
interface PanelConfigView {
  /** Whether the patch file carries this plugin's entry. */
  found: boolean;
  /** Mountable sections after config degradation. */
  sections: PanelSectionView[];
  /** Usable reference pairs after config degradation. */
  history: PanelPairView[];
  /** Whether subagent-originated sessions are opted in. */
  includeSubagents: boolean;
  /** Reference-history application mode. */
  historyMode: string;
  /** Conversational-seed mechanism: 'hook' (route A) | 'append' (route B, default) | 'intercept' (route C). */
  seedMode: string;
}
/** Result of reading the profile patch entry. */
interface PanelConfigReadResult {
  /** Whether the patch file was read successfully. */
  ok: boolean;
  /** Absolute path of the profile patch file. */
  path: string;
  /** Raw file text; empty when the read failed. */
  raw: string;
  /** Parsed entry view; `found` is false when the file lacks the entry. */
  parsed: PanelConfigView;
  /** Human-readable failure reason; empty on success. */
  error: string;
}
/** Result of writing the profile patch file. */
interface PanelWriteResult {
  /** Whether the file was written. */
  ok: boolean;
  /** Absolute path of the profile patch file. */
  path: string;
  /** Present when the write succeeded. */
  saved?: boolean;
  /** Human-readable failure reason; empty on success. */
  error: string;
}
/** One captured model request, reduced to plaintext leaf fields. */
interface PanelRequestView {
  /** Capture ordinal, reset by the clear operation. */
  id: number;
  /** Capture timestamp (epoch milliseconds). */
  time: number;
  /** Model id, when the request carried one. */
  model: string;
  /** Provider route, when the request carried one. */
  provider: string;
  /** System prompt text, when the request carried one. */
  system: string;
  /** Plaintext message list. */
  messages: {
    role: string;
    text: string;
  }[];
}
/** Ring snapshot plus the listener state the panel owns. */
interface PanelRequestsView {
  /** Captured requests, oldest first. */
  requests: PanelRequestView[];
  /** Whether capture is paused (default true). */
  paused: boolean;
  /** Whether the composer dock strip is visible. */
  dockVisible: boolean;
}
/** One assembled section contributed by this plugin. */
interface PanelAssembledSection {
  /** Full registry name (`custom-first-control-prompt:<name>`). */
  name: string;
  /** Rendered section text. */
  text: string;
  /** Render position. */
  order: number;
}
/** Result of assembling this plugin's live system-prompt sections. */
interface PanelAssembleResult {
  /** Sections contributed by this plugin in the current assembly. */
  sections: PanelAssembledSection[];
  /** Human-readable failure reason; empty on success. */
  error?: string;
}
//#endregion
//#region src/panel.d.ts
/** The web panel management service. */
declare class PanelService extends TypertRemoteService {
  private readonly ring;
  private seq;
  private paused;
  private dockVisible;
  constructor(ctx: Context);
  private capture;
  private patchPath;
  private writePolicy;
  private static yamlUnquote;
  private static yamlScalar;
  private static parseBlock;
  /** Render just the core `custom-first-control-prompt` loader row (4-space indent block). */
  private static coreBlock;
  private static buildPatch;
  /**
   * Return `existingRaw` with the core `custom-first-control-prompt` row's
   * config replaced by `config`, preserving every other line — comments, other
   * patch entries, and especially the manually-added panel client row
   * (`ui-custom-first-control-prompt`), which older bundles require and which a
   * blanket overwrite dropped silently (losing the UI). When the file has no
   * core row yet, a fresh file yields the full header block; otherwise a new
   * `- insert:` block carrying the core row is appended.
   */
  private static mergeCoreBlock;
  private readPatch;
  private writePatch;
  /** Read the profile patch entry. */
  configRead(agent: Agent): Promise<PanelConfigReadResult>;
  /** Write the profile patch entry regenerated from the panel's config view. */
  configWrite(agent: Agent, config: PanelConfigView): Promise<PanelWriteResult>;
  /** Clear the configured prompt content, keeping the plugin installed (and any other patch lines). */
  configClear(agent: Agent): Promise<PanelWriteResult>;
  /** Import a raw patch file text wholesale. */
  configRawImport(agent: Agent, raw: string): Promise<PanelWriteResult>;
  /** Snapshot the captured request ring plus listener state. */
  requestsList(agent: Agent): PanelRequestsView;
  /** Pause or resume request capture. */
  requestsSetPaused(agent: Agent, paused: boolean): PanelRequestsView;
  /** Clear the captured request ring. */
  requestsClear(agent: Agent): PanelRequestsView;
  /** Show or hide the composer dock strip. */
  uiSetDockVisible(agent: Agent, visible: boolean): PanelRequestsView;
  /** Assemble this plugin's live system-prompt sections for the preview tab. */
  previewAssemble(agent: Agent): Promise<PanelAssembleResult>;
}
//#endregion
//#region src/index.d.ts
/** Cordis plugin name, also the plugin attribution on the seeded message. */
declare const name = "custom-first-control-prompt";
/**
 * Required services: the agent registry for session lifecycle events, the
 * system-prompt registry for sections, plus `llm` (request redispatch) and
 * `sessions` (subagent-origin filtering) for the `intercept` seed mode.
 */
declare const inject: string[];
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
interface SectionEntry {
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
type HistoryMode = 'session-start' | 'reapply' | 'per-request';
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
type SeedMode = 'hook' | 'append' | 'intercept';
/** Plugin configuration; see README for the full contract. */
interface Config {
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
declare const Config: z<Config>;
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
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, HistoryMode, SectionEntry, SeedMode, apply, inject, name };
//# sourceMappingURL=index.d.ts.map