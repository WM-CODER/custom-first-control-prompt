/**
 * Shared request-ring polling: one bounded Remote call per interval, error
 * carried as state (never thrown). Used by the dock, the plugin card, and
 * the LLM-listening tab.
 *
 * @module @wm-coders/dsh-client-ui-custom-first-control-prompt/poll
 */
import { useEffect, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { PanelRequestsView } from '@wm-coders/dsh-custom-first-control-prompt/client'
import type { PanelActions } from './actions.ts'

/** Snapshot of the panel's request ring and listener state, or a failure. */
export interface RequestsPollState {
  /** Latest view; undefined while the first call is in flight or without a session. */
  view: PanelRequestsView | undefined
  /** Human-readable failure of the latest call. */
  error: string | undefined
  /** Force an immediate refresh (used after mutating verbs). */
  refresh: () => void
}

/** Poll interval for the request ring. */
const POLL_MS = 2000

/** Internal state pair; fields stay explicit to satisfy exactOptionalPropertyTypes. */
interface PollSlice {
  view: PanelRequestsView | undefined
  error: string | undefined
}

/**
 * Poll the panel service's request ring every two seconds. The interval is
 * cancelled on unmount; `actions` and `sessionId` changes restart it.
 * @param actions - the bound panel verbs.
 * @param sessionId - the owning session; undefined disables polling.
 */
export function useRequestsPoll(actions: PanelActions, sessionId: SessionId | undefined): RequestsPollState {
  const [state, setState] = useState<PollSlice>({ view: undefined, error: undefined })

  useEffect(() => {
    if (sessionId === undefined) {
      setState({ view: undefined, error: undefined })
      return
    }
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await actions.requests(sessionId)
      if (cancelled) return
      if (result.ok) {
        setState({ view: result.value, error: undefined })
      } else setState(previous => ({ ...previous, error: result.error.message }))
    }
    void load()
    const timer = setInterval(() => { void load() }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [actions, sessionId])

  return {
    view: state.view,
    error: state.error,
    refresh: () => {
      if (sessionId === undefined) return
      void actions.requests(sessionId).then((result) => {
        if (result.ok) setState({ view: result.value, error: undefined })
        else setState(previous => ({ ...previous, error: result.error.message }))
      })
    },
  }
}
