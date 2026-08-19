import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { PanelRequestsView } from '@wm-coder/dsh-custom-first-control-prompt/client';
import type { PanelActions } from './actions.ts';
/** Snapshot of the panel's request ring and listener state, or a failure. */
export interface RequestsPollState {
    /** Latest view; undefined while the first call is in flight or without a session. */
    view: PanelRequestsView | undefined;
    /** Human-readable failure of the latest call. */
    error: string | undefined;
    /** Force an immediate refresh (used after mutating verbs). */
    refresh: () => void;
}
/**
 * Poll the panel service's request ring every two seconds. The interval is
 * cancelled on unmount; `actions` and `sessionId` changes restart it.
 * @param actions - the bound panel verbs.
 * @param sessionId - the owning session; undefined disables polling.
 */
export declare function useRequestsPoll(actions: PanelActions, sessionId: SessionId | undefined): RequestsPollState;
//# sourceMappingURL=poll.d.ts.map