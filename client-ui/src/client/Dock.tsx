/**
 * Composer dock strip: a collapsible bar above the message input showing the
 * panel's live request-listening state. Listening defaults to off; the strip
 * offers start/stop, clear, expand/collapse, and hide (re-enabled from the
 * plugin card in settings). All state arrives from the Host panel service.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { PanelRequestView } from '@deepseek-ai/dsh-custom-first-control-prompt/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PanelActions } from './actions.ts'
import { useRequestsPoll } from './poll.ts'
import type { CfcpKey } from './locales.ts'
import css from './panel.module.css'

export interface DockProps extends PropsLocale<'cfcp.panel'> {
  /** The session this dock strip belongs to. */
  sessionId: SessionId
  /** Bound panel verbs. */
  actions: PanelActions
}

/** One captured request body: system prompt then the message list. */
function RequestBody(props: { request: PanelRequestView; t: (key: CfcpKey) => string }): ReactNode {
  const { request, t } = props
  return (
    <div className={css['requestBody']}>
      <div className={css['requestMeta']}>
        <span>{t('requestModel')}: {request.model || '—'}</span>
        <span>{t('requestProvider')}: {request.provider || '—'}</span>
        <span>{t('requestTime')}: {new Date(request.time).toLocaleTimeString()}</span>
      </div>
      {request.system.length > 0
        ? (
          <>
            <div className={css['blockLabel']}>{t('requestSystem')}</div>
            <pre className={css['mono']}>{request.system}</pre>
          </>
        )
        : null}
      {request.messages.length > 0
        ? (
          <>
            <div className={css['blockLabel']}>{t('requestMessages')}</div>
            {request.messages.map((message, at) => (
              <pre className={css['mono']} key={at}><span className={css['role']}>{message.role}</span>{' '}{message.text}</pre>
            ))}
          </>
        )
        : null}
    </div>
  )
}

/**
 * Render the dock strip. Hidden state (Host-side `dockVisible` false) renders
 * nothing; the strip comes back through the plugin card in settings.
 * @param props - composed slot props.
 */
export function Dock(props: DockProps): ReactNode {
  const { sessionId, actions, t } = props
  const [expanded, setExpanded] = useState(false)
  const { view, error, refresh } = useRequestsPoll(actions, sessionId)

  if (view !== undefined && !view.dockVisible) return null
  const paused = view?.paused ?? true
  const requests = view?.requests ?? []
  const latest: PanelRequestView | undefined = requests[requests.length - 1]

  const run = (promise: Promise<unknown>): void => {
    void promise.then(() => { refresh() })
  }

  return (
    <div className={css['dock']}>
      <div className={css['dockHeader']}>
        <button type="button" className={css['dockTitle']} onClick={() => { setExpanded(value => !value) }}
          aria-expanded={expanded} title={expanded ? t('collapse') : t('expand')}>
          <span>{t('dockLabel')}</span>
          <span className={paused ? css['badgeOff'] : css['badgeOn']}>
            {paused ? t('listeningOff') : t('listeningOn')}
          </span>
          <span className={css['count']}>{requests.length} {t('requests')}</span>
        </button>
        <div className={css['dockButtons']}>
          <button type="button" onClick={() => { run(actions.setPaused(sessionId, !paused)) }}>
            {paused ? t('start') : t('stop')}
          </button>
          <button type="button" onClick={() => { run(actions.clearRequests(sessionId)) }}>
            {t('clear')}
          </button>
          <button type="button" onClick={() => { run(actions.setDockVisible(sessionId, false)) }}>
            {t('dockHide')}
          </button>
        </div>
      </div>
      {expanded
        ? (
          <div className={css['dockBody']}>
            {error !== undefined ? <div className={css['error']}>{error}</div> : null}
            {requests.length === 0
              ? <div className={css['hint']}>{t('emptyRequests')}</div>
              : (
                <div className={css['requestList']}>
                  {requests.map(request => (
                    <details className={css['requestItem']} key={request.id} open={request === latest}>
                      <summary>
                        <span>#{request.id}</span>
                        <span>{request.purpose.length > 0 ? `[${request.purpose}] ` : ''}{request.model || '?'} · {request.messages.length} {t('requestMessages')}</span>
                        <span>{new Date(request.time).toLocaleTimeString()}</span>
                      </summary>
                      <RequestBody request={request} t={t} />
                    </details>
                  ))}
                </div>
              )}
          </div>
        )
        : null}
    </div>
  )
}
