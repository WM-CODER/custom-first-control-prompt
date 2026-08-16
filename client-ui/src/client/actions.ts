/**
 * The panel's Remote face, bound to the Host PanelService through the
 * Typert Remote namespace `custom-first-control-prompt-panel`. Every method
 * resolves to a `RemoteResult`; callers unwrap it (no carrier rejection).
 *
 * @module @deepseek-ai/dsh-client-ui-custom-first-control-prompt/actions
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the Host panel service's Remote namespace merge so the
// generated namespace face type below resolves.
import type {} from '@deepseek-ai/dsh-custom-first-control-prompt/remote'
import type { RemoteFailure, RemoteResult, TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol'
import type {
  PanelAssembleResult,
  PanelConfigReadResult,
  PanelConfigView,
  PanelRequestsView,
  PanelWriteResult,
} from '@deepseek-ai/dsh-custom-first-control-prompt/client'

/** The generated namespace face: the `remote.<namespace>` Cordis child service's methods. */
type PanelRemoteFace = TypertRemoteNamespaceMap['custom-first-control-prompt-panel']

/** The panel verbs the UI binds; every call names the owning session. */
export interface PanelActions {
  /** Read the profile patch entry. */
  read(sessionId: SessionId): Promise<RemoteResult<PanelConfigReadResult>>
  /** Regenerate and write the patch entry from the config view. */
  write(sessionId: SessionId, config: PanelConfigView): Promise<RemoteResult<PanelWriteResult>>
  /** Clear the configured prompt content (plugin stays installed). */
  clear(sessionId: SessionId): Promise<RemoteResult<PanelWriteResult>>
  /** Replace the patch file content with raw text. */
  importRaw(sessionId: SessionId, raw: string): Promise<RemoteResult<PanelWriteResult>>
  /** Snapshot the captured request ring plus listener state. */
  requests(sessionId: SessionId): Promise<RemoteResult<PanelRequestsView>>
  /** Pause or resume request capture. */
  setPaused(sessionId: SessionId, paused: boolean): Promise<RemoteResult<PanelRequestsView>>
  /** Clear the captured request ring. */
  clearRequests(sessionId: SessionId): Promise<RemoteResult<PanelRequestsView>>
  /** Show or hide the composer dock strip. */
  setDockVisible(sessionId: SessionId, visible: boolean): Promise<RemoteResult<PanelRequestsView>>
  /** Assemble this plugin's live system-prompt sections. */
  assemble(sessionId: SessionId): Promise<RemoteResult<PanelAssembleResult>>
}

/** Assembly-level failure shape for a namespace that never mounted. */
function unavailable(method: string): { ok: false; error: RemoteFailure } {
  return {
    ok: false,
    error: {
      code: 'remote-unavailable',
      message: `panel Remote method ${method} is unavailable (the custom-first-control-prompt-panel namespace is not mounted)`,
      details: {},
    },
  }
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
export function createPanelActions(ctx: ClientContext): PanelActions {
  const panel = ctx.get('remote.custom-first-control-prompt-panel') as PanelRemoteFace | undefined
  const call = async <T>(method: keyof PanelRemoteFace, args: unknown[]): Promise<RemoteResult<T>> => {
    if (panel === undefined) return unavailable(String(method))
    const fn = panel[method] as unknown as ((...values: unknown[]) => Promise<RemoteResult<T>>) | undefined
    if (typeof fn !== 'function') return unavailable(String(method))
    try {
      return await fn(...args)
    } catch (error) {
      // Only assembly faults reject (mount withdrawn mid-call etc.); fold them
      // into the same error branch the UI already unwraps.
      return {
        ok: false,
        error: {
          code: 'remote-call-failed',
          message: error instanceof Error ? error.message : String(error),
          details: {},
        },
      }
    }
  }
  return {
    read: sessionId => call('config-read', [sessionId]),
    write: (sessionId, config) => call('config-write', [sessionId, config]),
    clear: sessionId => call('config-clear', [sessionId]),
    importRaw: (sessionId, raw) => call('config-raw-import', [sessionId, raw]),
    requests: sessionId => call('requests-list', [sessionId]),
    setPaused: (sessionId, paused) => call('requests-set-paused', [sessionId, paused]),
    clearRequests: sessionId => call('requests-clear', [sessionId]),
    setDockVisible: (sessionId, visible) => call('ui-set-dock-visible', [sessionId, visible]),
    assemble: sessionId => call('preview-assemble', [sessionId]),
  }
}
