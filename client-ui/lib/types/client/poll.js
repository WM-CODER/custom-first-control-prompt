/**
 * Shared request-ring polling: one bounded Remote call per interval, error
 * carried as state (never thrown). Used by the dock, the plugin card, and
 * the LLM-listening tab.
 *
 * @module @deepseek-ai/dsh-client-ui-custom-first-control-prompt/poll
 */
import { useEffect, useState } from 'react';
/** Poll interval for the request ring. */
const POLL_MS = 2000;
/**
 * Poll the panel service's request ring every two seconds. The interval is
 * cancelled on unmount; `actions` and `sessionId` changes restart it.
 * @param actions - the bound panel verbs.
 * @param sessionId - the owning session; undefined disables polling.
 */
export function useRequestsPoll(actions, sessionId) {
    const [state, setState] = useState({ view: undefined, error: undefined });
    useEffect(() => {
        if (sessionId === undefined) {
            setState({ view: undefined, error: undefined });
            return;
        }
        let cancelled = false;
        const load = async () => {
            const result = await actions.requests(sessionId);
            if (cancelled)
                return;
            if (result.ok)
                setState({ view: result.value, error: undefined });
            else
                setState(previous => ({ ...previous, error: result.error.message }));
        };
        void load();
        const timer = setInterval(() => { void load(); }, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [actions, sessionId]);
    return {
        view: state.view,
        error: state.error,
        refresh: () => {
            if (sessionId === undefined)
                return;
            void actions.requests(sessionId).then((result) => {
                if (result.ok)
                    setState({ view: result.value, error: undefined });
                else
                    setState(previous => ({ ...previous, error: result.error.message }));
            });
        },
    };
}
//# sourceMappingURL=poll.js.map