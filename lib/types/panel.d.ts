/**
 * Web panel management service for custom-first-control-prompt: reads and
 * writes this plugin's entry in the profile patch file, captures a bounded
 * ring of real model requests, and exposes the whole surface to the browser
 * half through Typert Remote methods.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt/panel
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { PanelAssembleResult, PanelConfigReadResult, PanelConfigView, PanelRequestsView, PanelWriteResult } from './panel-types.ts';
/** Service key: the client reaches these methods as `ctx.remote['custom-first-control-prompt-panel']`. */
export declare const PANEL_SERVICE_KEY = "custom-first-control-prompt-panel";
/** The web panel management service. */
export declare class PanelService extends TypertRemoteService {
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
//# sourceMappingURL=panel.d.ts.map