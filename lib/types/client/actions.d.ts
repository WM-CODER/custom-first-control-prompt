/**
 * The panel's Remote face, bound to the Host PanelService through the
 * Typert Remote namespace `custom-first-control-prompt-panel`. Every method
 * resolves to a `RemoteResult`; callers unwrap it (no carrier rejection).
 *
 * @module @wm-coders/dsh-custom-first-control-prompt/actions
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { PanelAssembleResult, PanelConfigReadResult, PanelConfigView, PanelRequestsView, PanelWriteResult } from '@wm-coders/dsh-custom-first-control-prompt/typert-client';
/** The panel verbs the UI binds; every call names the owning session. */
export interface PanelActions {
    /** Read the profile patch entry. */
    read(sessionId: SessionId): Promise<RemoteResult<PanelConfigReadResult>>;
    /** Regenerate and write the patch entry from the config view. */
    write(sessionId: SessionId, config: PanelConfigView): Promise<RemoteResult<PanelWriteResult>>;
    /** Clear the configured prompt content (plugin stays installed). */
    clear(sessionId: SessionId): Promise<RemoteResult<PanelWriteResult>>;
    /** Replace the patch file content with raw text. */
    importRaw(sessionId: SessionId, raw: string): Promise<RemoteResult<PanelWriteResult>>;
    /** Snapshot the captured request ring plus listener state. */
    requests(sessionId: SessionId): Promise<RemoteResult<PanelRequestsView>>;
    /** Pause or resume request capture. */
    setPaused(sessionId: SessionId, paused: boolean): Promise<RemoteResult<PanelRequestsView>>;
    /** Clear the captured request ring. */
    clearRequests(sessionId: SessionId): Promise<RemoteResult<PanelRequestsView>>;
    /** Show or hide the composer dock strip. */
    setDockVisible(sessionId: SessionId, visible: boolean): Promise<RemoteResult<PanelRequestsView>>;
    /** Assemble this plugin's live system-prompt sections. */
    assemble(sessionId: SessionId): Promise<RemoteResult<PanelAssembleResult>>;
}
/**
 * Bind the Host panel service's Remote namespace to the given client context.
 *
 * The namespace is read through `ctx.get()` — the ungated optional-service
 * read — instead of the `ctx.remote.<namespace>` property, whose access the
 * Cordis context proxy authorizes only for injected services. This package
 * mounts the namespace itself (the published api-remotes assembly cannot
 * cover a third-party namespace), and injecting a service one's own apply
 * provides would deadlock fiber activation, so the property form cannot be
 * used here; `ctx.get` sees the same `remote.<namespace>` child service.
 * @param ctx - client root context; the namespace must already be mounted
 *   (apply mounts it before calling this factory).
 */
export declare function createPanelActions(ctx: ClientContext): PanelActions;
//# sourceMappingURL=actions.d.ts.map