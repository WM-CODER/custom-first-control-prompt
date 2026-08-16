/**
 * Plugin card inside the Plugins settings section: dock-strip visibility and
 * LLM-listening toggles with the live request count. Root-scoped, so the
 * owning session resolves from the session list (current first, then any).
 */

import type { ReactNode } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { PanelActions } from './actions.ts'
import { useRequestsPoll } from './poll.ts'
import css from './panel.module.css'

export interface PluginCardProps extends PropsLocale<'cfcp.panel'> {
  /** Standard global prop: session-list selector. */
  useSessions: SnapshotSelectorHook<SessionListState>
  /** Bound panel verbs. */
  actions: PanelActions
}

/**
 * Render the plugin card.
 * @param props - composed slot props.
 */
export function PluginCard(props: PluginCardProps): ReactNode {
  const { actions, useSessions, t } = props
  const sessionId = useSessions(s => s.current ?? s.ids[0])
  const { view, error, refresh } = useRequestsPoll(actions, sessionId)

  const dockVisible = view?.dockVisible ?? true
  const paused = view?.paused ?? true
  const disabled = sessionId === undefined

  const run = (promise: Promise<unknown>): void => {
    void promise.then(() => { refresh() })
  }

  return (
    <div className={css['card']}>
      <div className={css['cardTitle']}>{t('cardTitle')}</div>
      {disabled ? <div className={css['hint']}>{t('noSession')}</div> : null}
      <label className={css['row']}>
        <input
          type="checkbox"
          checked={dockVisible}
          disabled={disabled}
          onChange={event => { if (sessionId !== undefined) run(actions.setDockVisible(sessionId, event.target.checked)) }}
        />
        <span>{t('toggleDock')}</span>
      </label>
      <label className={css['row']}>
        <input
          type="checkbox"
          checked={!paused}
          disabled={disabled}
          onChange={event => { if (sessionId !== undefined) run(actions.setPaused(sessionId, !event.target.checked)) }}
        />
        <span>{t('toggleListen')}</span>
        <span className={css['count']}>{view?.requests.length ?? 0} {t('requests')}</span>
      </label>
      {error !== undefined ? <div className={css['error']}>{error}</div> : null}
    </div>
  )
}
