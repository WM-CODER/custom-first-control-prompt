// @vitest-environment jsdom
/**
 * Panel surface tests: the three UI components against a stub PanelActions
 * face. The Remote transport itself is covered by the core plugin's Typert
 * generator output; here we pin the UI contracts (buttons call the right
 * verbs, tabs load the right views, no-session renders the hint).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the 'cfcp.panel' LocaleNamespaceMap merge into this program.
import type {} from '../src/client/index.ts'
import type {
  PanelConfigReadResult,
  PanelConfigView,
  PanelRequestsView,
  PanelWriteResult,
} from '@deepseek-ai/dsh-custom-first-control-prompt/client'
import type { PanelActions } from '../src/client/actions.ts'
import { Dock } from '../src/client/Dock.tsx'
import { PluginCard } from '../src/client/PluginCard.tsx'
import { PanelSection } from '../src/client/PanelSection.tsx'

const SESSION: SessionId = 's1' as SessionId

function requestsView(paused = true, count = 0): PanelRequestsView {
  const requests = Array.from({ length: count }, (_v, at) => ({
    id: at + 1,
    time: Date.now(),
    model: 'deepseek-chat',
    provider: 'deepseek',
    system: 'system text',
    purpose: '',
    messages: [{ role: 'user', text: `hello ${at}` }],
  }))
  return { requests, paused, dockVisible: true }
}

function configRead(): PanelConfigReadResult {
  const parsed: PanelConfigView = {
    found: true,
    sections: [{ name: 'rules', order: 0, text: 'be brief', enabled: true }],
    history: [{ user: 'u', assistant: 'a' }],
    includeSubagents: false,
  }
  return { ok: true, path: '/profiles/web/cordis.patch.yml', raw: '- insert: []', parsed, error: '' }
}

function writeOk(): PanelWriteResult {
  return { ok: true, path: '/profiles/web/cordis.patch.yml', saved: true, error: '' }
}

function makeActions(overrides: Partial<PanelActions> = {}): PanelActions {
  return {
    read: vi.fn(async () => ({ ok: true as const, value: configRead() })),
    write: vi.fn(async () => ({ ok: true as const, value: writeOk() })),
    clear: vi.fn(async () => ({ ok: true as const, value: writeOk() })),
    importRaw: vi.fn(async () => ({ ok: true as const, value: writeOk() })),
    requests: vi.fn(async () => ({ ok: true as const, value: requestsView() })),
    setPaused: vi.fn(async () => ({ ok: true as const, value: requestsView(false, 1) })),
    clearRequests: vi.fn(async () => ({ ok: true as const, value: requestsView() })),
    setDockVisible: vi.fn(async () => ({ ok: true as const, value: requestsView() })),
    assemble: vi.fn(async () => ({
      ok: true as const,
      value: { sections: [{ name: 'custom-first-control-prompt:rules', text: 'be brief', order: 0 }] },
    })),
    ...overrides,
  }
}

const t = (key => key) as TranslateNS<'cfcp.panel'>

const useSessionsWith = (sessionId: SessionId | undefined): SnapshotSelectorHook<SessionListState> =>
  ((selector: (state: SessionListState) => SessionId | undefined) =>
    selector({ current: sessionId, ids: sessionId === undefined ? [] : [sessionId] } as never)) as never

afterEach(() => { cleanup() })

describe('Dock', () => {
  it('renders paused by default and routes start/clear/hide to the verbs', async () => {
    const actions = makeActions()
    render(<Dock sessionId={SESSION} actions={actions} t={t} />)
    expect(screen.getByText('listeningOff')).toBeTruthy()
    fireEvent.click(screen.getByText('start'))
    fireEvent.click(screen.getByText('clear'))
    fireEvent.click(screen.getByText('dockHide'))
    expect(actions.setPaused).toHaveBeenCalledWith(SESSION, false)
    expect(actions.clearRequests).toHaveBeenCalledWith(SESSION)
    expect(actions.setDockVisible).toHaveBeenCalledWith(SESSION, false)
  })

  it('renders nothing when the host reports the dock hidden', async () => {
    const actions = makeActions({
      requests: vi.fn(async () => ({ ok: true as const, value: { ...requestsView(), dockVisible: false } })),
    })
    const { container } = render(<Dock sessionId={SESSION} actions={actions} t={t} />)
    await vi.waitFor(() => { expect(container.innerHTML).toBe('') })
  })
})

describe('PluginCard', () => {
  it('toggles dock visibility and listening through the verbs', () => {
    const actions = makeActions()
    render(<PluginCard useSessions={useSessionsWith(SESSION)} actions={actions} t={t} />)
    fireEvent.click(screen.getByText('toggleListen'))
    expect(actions.setPaused).toHaveBeenCalledWith(SESSION, false)
    fireEvent.click(screen.getByText('toggleDock'))
    expect(actions.setDockVisible).toHaveBeenCalledWith(SESSION, false)
  })

  it('shows the no-session hint and keeps controls disabled', () => {
    const actions = makeActions()
    render(<PluginCard useSessions={useSessionsWith(undefined)} actions={actions} t={t} />)
    expect(screen.getByText('noSession')).toBeTruthy()
  })
})

describe('PanelSection', () => {
  it('loads the config on the config tab and writes on save', async () => {
    const actions = makeActions()
    render(<PanelSection close={() => {}} useSessions={useSessionsWith(SESSION)} actions={actions} t={t} />)
    fireEvent.click(screen.getByText('tabConfig'))
    await vi.waitFor(() => { expect(screen.getByDisplayValue('rules')).toBeTruthy() })
    fireEvent.click(screen.getByText('save'))
    await vi.waitFor(() => { expect(actions.write).toHaveBeenCalled() })
    await vi.waitFor(() => { expect(screen.getByText('saved')).toBeTruthy() })
  })

  it('assembles the live sections on the preview tab', async () => {
    const actions = makeActions()
    render(<PanelSection close={() => {}} useSessions={useSessionsWith(SESSION)} actions={actions} t={t} />)
    await vi.waitFor(() => { expect(actions.assemble).toHaveBeenCalled() })
    await vi.waitFor(() => { expect(screen.getByText('be brief')).toBeTruthy() })
  })

  it('imports raw text on the raw tab', async () => {
    const actions = makeActions()
    render(<PanelSection close={() => {}} useSessions={useSessionsWith(SESSION)} actions={actions} t={t} />)
    fireEvent.click(screen.getByText('tabRaw'))
    await vi.waitFor(() => { expect(screen.getByDisplayValue('- insert: []')).toBeTruthy() })
    fireEvent.click(screen.getByText('importRaw'))
    await vi.waitFor(() => { expect(actions.importRaw).toHaveBeenCalled() })
  })

  it('shows the no-session hint when no session exists', () => {
    const actions = makeActions()
    render(<PanelSection close={() => {}} useSessions={useSessionsWith(undefined)} actions={actions} t={t} />)
    expect(screen.getByText('noSession')).toBeTruthy()
  })
})
