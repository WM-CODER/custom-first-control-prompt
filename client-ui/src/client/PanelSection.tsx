/**
 * Settings section: preview / config / RAW / LLM-listening tabs over the Host
 * panel service. Root-scoped; the owning session resolves from the session
 * list (current first, then any session).
 */

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  PanelAssembledSection,
  PanelConfigView,
  PanelSectionView,
  PanelPairView,
} from '@deepseek-ai/dsh-custom-first-control-prompt/client'
import type { PanelActions } from './actions.ts'
import { useRequestsPoll } from './poll.ts'
import type { CfcpKey } from './locales.ts'
import css from './panel.module.css'

/** Section tab keys. */
type Tab = 'preview' | 'config' | 'raw' | 'requests'

export interface PanelSectionProps extends PropsLocale<'cfcp.panel'> {
  /** Close the settings panel (shell-owned). */
  close: () => void
  /** Standard global prop: session-list selector. */
  useSessions: SnapshotSelectorHook<SessionListState>
  /** Bound panel verbs. */
  actions: PanelActions
}

/** Empty editable config view. */
function emptyConfig(): PanelConfigView {
  return { found: false, sections: [], history: [], includeSubagents: false, historyMode: 'reapply', seedMode: 'append' }
}

/**
 * Render the settings section.
 * @param props - composed slot props.
 */
export function PanelSection(props: PanelSectionProps): ReactNode {
  const { actions, useSessions, t } = props
  const sessionId = useSessions(s => s.current ?? s.ids[0])
  const [tab, setTab] = useState<Tab>('preview')

  const [config, setConfig] = useState<PanelConfigView>(() => emptyConfig())
  const [raw, setRaw] = useState('')
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<PanelAssembledSection[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)

  const { view: requestsView, error: requestsError, refresh: refreshRequests } = useRequestsPoll(actions, sessionId)

  const loadConfig = useCallback(async (): Promise<void> => {
    if (sessionId === undefined) return
    const result = await actions.read(sessionId)
    if (result.ok) {
      setConfig(result.value.parsed)
      setRaw(result.value.raw)
      setPath(result.value.path)
      setError(undefined)
    } else {
      setError(result.error.message)
    }
  }, [actions, sessionId])

  const loadPreview = useCallback(async (): Promise<void> => {
    if (sessionId === undefined) return
    const result = await actions.assemble(sessionId)
    if (result.ok) {
      setPreview(result.value.sections)
      setError(undefined)
    } else {
      setError(result.error.message)
    }
  }, [actions, sessionId])

  useEffect(() => {
    setError(undefined)
    setNotice(undefined)
    if (sessionId === undefined) return
    if (tab === 'config' || tab === 'raw') void loadConfig()
    else if (tab === 'preview') void loadPreview()
  }, [tab, sessionId, actions, loadConfig, loadPreview])

  const save = async (): Promise<void> => {
    if (sessionId === undefined) return
    setBusy(true)
    setNotice(undefined)
    const result = await actions.write(sessionId, config)
    setBusy(false)
    if (result.ok) {
      setNotice(t('saved'))
      setError(undefined)
      await loadConfig()
    } else {
      setError(result.error.message)
    }
  }

  const clearAll = async (): Promise<void> => {
    if (sessionId === undefined) return
    setBusy(true)
    setNotice(undefined)
    const result = await actions.clear(sessionId)
    setBusy(false)
    setClearArmed(false)
    if (result.ok) {
      setNotice(t('saved'))
      setError(undefined)
      await loadConfig()
    } else {
      setError(result.error.message)
    }
  }

  const importRaw = async (): Promise<void> => {
    if (sessionId === undefined) return
    setBusy(true)
    setNotice(undefined)
    const result = await actions.importRaw(sessionId, raw)
    setBusy(false)
    if (result.ok) {
      setNotice(t('saved'))
      setError(undefined)
      await loadConfig()
    } else {
      setError(result.error.message)
    }
  }

  const setSection = (at: number, patch: Partial<PanelSectionView>): void => {
    setConfig(previous => ({
      ...previous,
      sections: previous.sections.map((section, index) => index === at ? { ...section, ...patch } : section),
    }))
  }

  const setPair = (at: number, patch: Partial<PanelPairView>): void => {
    setConfig(previous => ({
      ...previous,
      history: previous.history.map((pair, index) => index === at ? { ...pair, ...patch } : pair),
    }))
  }

  const tabs: readonly { key: Tab; label: CfcpKey }[] = [
    { key: 'preview', label: 'tabPreview' },
    { key: 'config', label: 'tabConfig' },
    { key: 'raw', label: 'tabRaw' },
    { key: 'requests', label: 'tabRequests' },
  ]

  const renderTab = (): ReactNode => {
    if (sessionId === undefined) return <div className={css['hint']}>{t('noSession')}</div>
    switch (tab) {
      case 'preview':
        return (
          <div>
            <div className={css['hint']}>{t('previewNote')}</div>
            {preview.length === 0
              ? <div className={css['hint']}>{t('previewEmpty')}</div>
              : preview.map(section => (
                <div className={css['previewSection']} key={section.name}>
                  <div className={css['blockLabel']}>{section.name} (order {section.order})</div>
                  <pre className={css['mono']}>{section.text}</pre>
                </div>
              ))}
          </div>
        )
      case 'config': {
        const modeOptions: readonly { value: string; label: CfcpKey }[] = [
          { value: 'reapply', label: 'modeReapply' },
          { value: 'session-start', label: 'modeSessionStart' },
          { value: 'per-request', label: 'modePerRequest' },
        ]
        const seedModeOptions: readonly { value: string; label: CfcpKey }[] = [
          { value: 'hook', label: 'seedModeHook' },
          { value: 'append', label: 'seedModeAppend' },
        ]
        return (
          <div>
            <div className={css['blockLabel']}>sections</div>
            {config.sections.map((section, at) => (
              <div className={css['editorRow']} key={at}>
                <label className={css['field']}>
                  <span>{t('sectionName')}</span>
                  <input value={section.name}
                    onChange={(event) => { setSection(at, { name: event.target.value }) }} />
                </label>
                <label className={css['field']}>
                  <span>{t('sectionOrder')}</span>
                  <input type="number" value={section.order}
                    onChange={(event) => {
                      const order = Number(event.target.value)
                      setSection(at, { order: Number.isFinite(order) ? order : 0 })
                    }} />
                </label>
                <label className={css['field']}>
                  <span>{t('sectionEnabled')}</span>
                  <input type="checkbox" checked={section.enabled}
                    onChange={(event) => { setSection(at, { enabled: event.target.checked }) }} />
                </label>
                <label className={css['fieldWide']}>
                  <span>{t('sectionText')}</span>
                  <textarea value={section.text}
                    onChange={(event) => { setSection(at, { text: event.target.value }) }} />
                </label>
                <button type="button" className={css['danger']}
                  onClick={() => {
                    setConfig(previous => ({
                      ...previous,
                      sections: previous.sections.filter((_s, index) => index !== at),
                    }))
                  }}>
                  {t('remove')}
                </button>
              </div>
            ))}
            <button type="button" onClick={() => {
              setConfig(previous => ({
                ...previous,
                sections: [...previous.sections, { name: '', order: previous.sections.length, text: '', enabled: true }],
              }))
            }}>
              {t('addSection')}
            </button>
            <div className={css['blockLabel']}>history</div>
            {config.history.map((pair, at) => (
              <div className={css['editorRow']} key={at}>
                <label className={css['fieldWide']}>
                  <span>{t('historyUser')}</span>
                  <textarea value={pair.user}
                    onChange={(event) => { setPair(at, { user: event.target.value }) }} />
                </label>
                <label className={css['fieldWide']}>
                  <span>{t('historyAssistant')}</span>
                  <textarea value={pair.assistant}
                    onChange={(event) => { setPair(at, { assistant: event.target.value }) }} />
                </label>
                <button type="button" className={css['danger']}
                  onClick={() => {
                    setConfig(previous => ({
                      ...previous,
                      history: previous.history.filter((_p, index) => index !== at),
                    }))
                  }}>
                  {t('remove')}
                </button>
              </div>
            ))}
            <button type="button" onClick={() => {
              setConfig(previous => ({
                ...previous,
                history: [...previous.history, { user: '', assistant: '' }],
              }))
            }}>
              {t('addPair')}
            </button>
            <label className={css['row']}>
              <input type="checkbox" checked={config.includeSubagents}
                onChange={(event) => { setConfig(previous => ({ ...previous, includeSubagents: event.target.checked })) }} />
              <span>{t('includeSubagents')}</span>
            </label>
            <label className={css['row']}>
              <span>{t('historyMode')}</span>
              <select value={config.historyMode}
                onChange={(event) => { setConfig(previous => ({ ...previous, historyMode: event.target.value })) }}>
                {modeOptions.map(option => (
                  <option value={option.value} key={option.value}>{t(option.label)}</option>
                ))}
              </select>
            </label>
            <label className={css['row']}>
              <span>{t('seedMode')}</span>
              <select value={config.seedMode}
                onChange={(event) => { setConfig(previous => ({ ...previous, seedMode: event.target.value })) }}>
                {seedModeOptions.map(option => (
                  <option value={option.value} key={option.value}>{t(option.label)}</option>
                ))}
              </select>
            </label>
            <div className={css['buttonsRow']}>
              <button type="button" disabled={busy} onClick={() => { void save() }}>{t('save')}</button>
              <button type="button" disabled={busy} className={clearArmed ? css['danger'] : ''}
                onClick={() => {
                  if (clearArmed) void clearAll()
                  else setClearArmed(true)
                }}>
                {clearArmed ? t('clearConfigConfirm') : t('clear')}
              </button>
            </div>
          </div>
        )
      }
      case 'raw':
        return (
          <div>
            <div className={css['hint']}>{path.length > 0 ? path : t('configNotFound')}</div>
            <textarea className={css['rawArea']} value={raw}
              onChange={(event) => { setRaw(event.target.value) }} spellCheck={false} />
            <div className={css['buttonsRow']}>
              <button type="button" disabled={busy} onClick={() => { void importRaw() }}>{t('importRaw')}</button>
            </div>
          </div>
        )
      case 'requests': {
        const requests = requestsView?.requests ?? []
        const paused = requestsView?.paused ?? true
        const latest = requests[requests.length - 1]
        return (
          <div>
            <div className={css['buttonsRow']}>
              <button type="button" onClick={() => {
                void actions.setPaused(sessionId, !paused).then(() => { refreshRequests() })
              }}>
                {paused ? t('start') : t('stop')}
              </button>
              <button type="button" onClick={() => {
                void actions.clearRequests(sessionId).then(() => { refreshRequests() })
              }}>
                {t('clear')}
              </button>
              <span className={css['count']}>{requests.length} {t('requests')}</span>
            </div>
            {requestsError !== undefined ? <div className={css['error']}>{requestsError}</div> : null}
            {requests.length === 0
              ? <div className={css['hint']}>{t('emptyRequests')}</div>
              : (
                <div className={css['requestList']}>
                  {requests.map(request => (
                    <details className={css['requestItem']} key={request.id} open={request === latest}>
                      <summary>
                        <span>#{request.id}</span>
                        <span>{request.model || '?'} · {request.messages.length} {t('requestMessages')}</span>
                        <span>{new Date(request.time).toLocaleTimeString()}</span>
                      </summary>
                      <div className={css['requestMeta']}>
                        <span>{t('requestModel')}: {request.model || '—'}</span>
                        <span>{t('requestProvider')}: {request.provider || '—'}</span>
                      </div>
                      {request.system.length > 0
                        ? (
                          <>
                            <div className={css['blockLabel']}>{t('requestSystem')}</div>
                            <pre className={css['mono']}>{request.system}</pre>
                          </>
                        )
                        : null}
                      {request.messages.map((message, at) => (
                        <pre className={css['mono']} key={at}><span className={css['role']}>{message.role}</span>{' '}{message.text}</pre>
                      ))}
                    </details>
                  ))}
                </div>
              )}
          </div>
        )
      }
    }
  }

  return (
    <div className={css['panel']}>
      <div className={css['tabs']} role="tablist">
        {tabs.map(({ key, label }) => (
          <button type="button" role="tab" aria-selected={tab === key} key={key}
            className={tab === key ? css['tabActive'] : css['tab']} onClick={() => { setTab(key) }}>
            {t(label)}
          </button>
        ))}
      </div>
      {notice !== undefined ? <div className={css['success']}>{notice}</div> : null}
      {error !== undefined ? <div className={css['error']}>{t('error', { message: error })}</div> : null}
      {renderTab()}
    </div>
  )
}
