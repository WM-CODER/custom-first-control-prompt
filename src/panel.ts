/**
 * Web panel management service for custom-first-control-prompt: reads and
 * writes this plugin's entry in the profile patch file, captures a bounded
 * ring of real model requests, and exposes the whole surface to the browser
 * half through Typert Remote methods.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt/panel
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  PanelAssembleResult,
  PanelConfigReadResult,
  PanelConfigView,
  PanelRequestView,
  PanelRequestsView,
  PanelWriteResult,
} from './panel-types.ts'

/** Minimal filesystem face the panel needs; the runtime fs service satisfies it. */
interface PanelFs {
  resolve(path: string): Promise<unknown>
  readText(target: unknown): Promise<string>
  writeText(target: unknown, content: string, expected?: unknown, signal?: unknown, sandboxPolicy?: unknown): Promise<unknown>
}

/** Minimal settings face: the provider's user-editable document path. */
interface PanelSettings {
  prepareDocument(): Promise<string | undefined>
}

/** Minimal sandbox-policy face: per-call execution policy resolution. */
interface PanelSandboxPolicy {
  resolve(request?: { mode?: string }): unknown
}

/** Minimal system-prompt face: section assembly for the preview tab. */
interface PanelSystemPrompt {
  assemble(context?: object): Promise<{ sections: readonly { name?: unknown; text?: unknown; order?: unknown }[] }>
}

/** Service key: the client reaches these methods as `ctx.remote['custom-first-control-prompt-panel']`. */
export const PANEL_SERVICE_KEY = 'custom-first-control-prompt-panel'

/** The web panel management service. */
export class PanelService extends TypertRemoteService {
  private readonly ring: PanelRequestView[] = []
  private seq = 0
  private paused = true
  private dockVisible = true

  constructor(ctx: Context) {
    super(ctx, 'custom-first-control-prompt-panel')
    ctx.on('llm/stream', (options: GenerateOptions, next) => {
      const stream = next()
      if (!this.paused) this.capture(options)
      return stream
    })
  }

  // ---- capture ----

  private capture(options: GenerateOptions): void {
    try {
      const record = options as GenerateOptions & Record<string, unknown>
      const entry: PanelRequestView = {
        id: ++this.seq,
        time: Date.now(),
        model: typeof record['model'] === 'string' ? record['model'] : '',
        provider: typeof record['provider'] === 'string' ? record['provider'] : '',
        system: typeof record['system'] === 'string' ? record['system'] : '',
        messages: [],
      }
      const msgs = Array.isArray(record['messages']) ? record['messages'] : []
      entry.messages = msgs.map((msg: unknown) => {
        let text = ''
        const m = typeof msg === 'object' && msg !== null ? msg as Record<string, unknown> : undefined
        if (typeof m?.['content'] === 'string') text = m['content']
        else if (Array.isArray(m?.['content'])) {
          text = (m['content'] as unknown[]).map((block) => {
            if (typeof block === 'string') return block
            const b = typeof block === 'object' && block !== null ? block as Record<string, unknown> : undefined
            return b?.['type'] === 'text' && typeof b['text'] === 'string' ? b['text'] : ''
          }).join('')
        }
        return { role: typeof m?.['role'] === 'string' ? m['role'] : 'unknown', text }
      })
      this.ring.push(entry)
      if (this.ring.length > 30) this.ring.shift()
    } catch (error) {
      this.ctx.logger?.warn('custom-first-control-prompt panel request capture failed: %s', String(error))
    }
  }

  // ---- patch file plumbing ----

  private async patchPath(): Promise<string | null> {
    const settings = this.ctx.get('settings') as PanelSettings | undefined
    if (settings !== undefined) {
      try {
        const doc = await settings.prepareDocument()
        if (typeof doc === 'string' && doc.length > 0) {
          const norm = doc.replace(/\\/g, '/')
          const i = norm.lastIndexOf('/')
          if (i > 0) return `${norm.slice(0, i)}/profiles/web/cordis.patch.yml`
        }
      } catch {
        // fall through to the explicit failure below
      }
    }
    return null
  }

  private writePolicy(): unknown {
    const policy = this.ctx.get('sandboxPolicy') as PanelSandboxPolicy | undefined
    try {
      return policy?.resolve({ mode: 'danger-full-access' })
    } catch {
      return undefined
    }
  }

  private static yamlUnquote(value: string): string {
    let s = value.trim()
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') s = s.slice(1, -1)
    else if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") s = s.slice(1, -1)
    return s.replace(/\\\\/g, '\u0000').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\u0000/g, '\\')
  }

  private static yamlScalar(value: string): string {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`
  }

  private static parseBlock(raw: string): PanelConfigView {
    const out: PanelConfigView = { found: false, sections: [], history: [], includeSubagents: false, historyMode: 'reapply', seedMode: 'append' }
    if (raw.indexOf('custom-first-control-prompt') < 0) return out
    out.found = true
    let zone: '' | 'sections' | 'history' = ''
    let cur: PanelConfigView['sections'][number] | PanelConfigView['history'][number] | null = null
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim()
      if (t.indexOf('sections:') === 0) { zone = 'sections'; cur = null; continue }
      if (t.indexOf('history:') === 0) { zone = 'history'; cur = null; continue }
      if (t.indexOf('includeSubagents:') === 0 || t.indexOf('historyMode:') === 0 || t.indexOf('seedMode:') === 0) { zone = ''; cur = null }
      if (zone === 'sections') {
        if (t.indexOf('- name:') === 0) {
          cur = { name: PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1)), order: 0, text: '', enabled: true }
          out.sections.push(cur)
        } else if (cur !== null && 'name' in cur && t.indexOf('order:') === 0) {
          cur.order = Number(t.slice(t.indexOf(':') + 1))
        } else if (cur !== null && 'name' in cur && t.indexOf('text:') === 0) {
          cur.text = PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1))
        }
      } else if (zone === 'history') {
        if (t.indexOf('- user:') === 0) {
          cur = { user: PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1)), assistant: '' }
          out.history.push(cur)
        } else if (cur !== null && 'assistant' in cur && t.indexOf('assistant:') === 0) {
          cur.assistant = PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1))
        }
      } else if (zone === '') {
        const m = t.match(/^includeSubagents:\s*(true|false)/)
        if (m) out.includeSubagents = m[1] === 'true'
        const h = t.match(/^historyMode:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/)
        if (h) out.historyMode = h[1] ?? h[2] ?? h[3] ?? 'reapply'
        const sm = t.match(/^seedMode:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/)
        if (sm) out.seedMode = sm[1] ?? sm[2] ?? sm[3] ?? 'hook'
      }
    }
    return out
  }

  /** Render just the core `custom-first-control-prompt` loader row (4-space indent block). */
  private static coreBlock(config: PanelConfigView | undefined): string {
    const sections = Array.isArray(config?.sections) ? config.sections : []
    const history = Array.isArray(config?.history) ? config.history : []
    const includeSubagents = config?.includeSubagents === true
    const mode = config?.historyMode === 'per-request' || config?.historyMode === 'session-start'
      ? config.historyMode
      : 'reapply'
    // Route B (append) is the default mechanism; only an explicit 'hook' opts back.
    const seedMode = config?.seedMode === 'hook' ? 'hook' : 'append'
    const secBlock = sections.length > 0
      ? sections.map(s => `          - name: ${PanelService.yamlScalar(s.name)}\n            order: ${Number(s.order) || 0}\n            text: ${PanelService.yamlScalar(s.text)}`).join('\n')
      : ''
    const hisBlock = history.length > 0
      ? history.map(p => `          - user: ${PanelService.yamlScalar(p.user)}\n            assistant: ${PanelService.yamlScalar(p.assistant)}`).join('\n')
      : ''
    return '    - id: custom-first-control-prompt\n'
      + "      name: '@deepseek-ai/dsh-custom-first-control-prompt'\n"
      + '      config:\n'
      + (sections.length > 0 ? `        sections:\n${secBlock}\n` : '        sections: []\n')
      + (history.length > 0 ? `        history:\n${hisBlock}\n` : '        history: []\n')
      + `        includeSubagents: ${includeSubagents ? 'true' : 'false'}\n`
      + `        historyMode: ${PanelService.yamlScalar(mode)}\n`
      + `        seedMode: ${PanelService.yamlScalar(seedMode)}\n`
  }

  private static buildPatch(config: PanelConfigView | undefined): string {
    return '# Your patch layer for this dsh profile, applied after every bundle layer:\n'
      + '# a top-level YAML array of loader patch entries (id-targeted config\n'
      + '# overrides, disables, and insert lists; `!!js` expressions allowed).\n'
      + '- insert:\n'
      + PanelService.coreBlock(config)
  }

  /**
   * Return `existingRaw` with the core `custom-first-control-prompt` row's
   * config replaced by `config`, preserving every other line — comments, other
   * patch entries, and especially the manually-added panel client row
   * (`ui-custom-first-control-prompt`), which older bundles require and which a
   * blanket overwrite dropped silently (losing the UI). When the file has no
   * core row yet, a fresh file yields the full header block; otherwise a new
   * `- insert:` block carrying the core row is appended.
   */
  private static mergeCoreBlock(existingRaw: string, config: PanelConfigView | undefined): string {
    const core = PanelService.coreBlock(config)
    const lines = existingRaw.split(/\r?\n/)
    const coreIdx = lines.findIndex(l => l.trim() === '- id: custom-first-control-prompt')
    if (coreIdx === -1) {
      if (existingRaw.trim() === '') return PanelService.buildPatch(config)
      const sep = existingRaw.endsWith('\n') ? '' : '\n'
      return existingRaw + sep + '- insert:\n' + core
    }
    const indent = (lines[coreIdx]?.match(/^\s*/)?.[0] ?? '').length
    // The core block ends at the next same-or-lower-indent `- ` entry (e.g. a
    // sibling `    - id: ui-custom-first-control-prompt`); that entry is kept.
    let end = coreIdx + 1
    while (end < lines.length) {
      const line = lines[end]!
      const trimmed = line.trim()
      if (trimmed.startsWith('- ') && (line.match(/^\s*/)?.[0] ?? '').length <= indent) break
      end++
    }
    return [...lines.slice(0, coreIdx), core, ...lines.slice(end)].join('\n')
  }

  private async readPatch(): Promise<PanelConfigReadResult> {
    const path = await this.patchPath()
    if (path === null) {
      return { ok: false, path: '', raw: '', parsed: PanelService.parseBlock(''), error: 'unable to locate the profile patch file (settings.prepareDocument() returned no path)' }
    }
    const fs = this.ctx.get('fs') as PanelFs | undefined
    if (fs === undefined) return { ok: false, path, raw: '', parsed: PanelService.parseBlock(''), error: 'fs service unavailable' }
    try {
      const target = await fs.resolve(path)
      const raw = await fs.readText(target)
      return { ok: true, path, raw, parsed: PanelService.parseBlock(raw), error: '' }
    } catch (error) {
      return { ok: false, path, raw: '', parsed: PanelService.parseBlock(''), error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async writePatch(raw: string): Promise<PanelWriteResult> {
    const path = await this.patchPath()
    if (path === null) {
      return { ok: false, path: '', error: 'unable to locate the profile patch file (settings.prepareDocument() returned no path)' }
    }
    const fs = this.ctx.get('fs') as PanelFs | undefined
    if (fs === undefined) return { ok: false, path, error: 'fs service unavailable' }
    try {
      const target = await fs.resolve(path)
      await fs.writeText(target, raw, undefined, undefined, this.writePolicy())
      return { ok: true, path, saved: true, error: '' }
    } catch (error) {
      return { ok: false, path, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // ---- Remote surface (the gateway prepends the live Agent authority) ----

  /** Read the profile patch entry. */
  @Remote('config-read')
  configRead(agent: Agent): Promise<PanelConfigReadResult> {
    void agent
    return this.readPatch()
  }

  /** Write the profile patch entry regenerated from the panel's config view. */
  @Remote('config-write')
  async configWrite(agent: Agent, config: PanelConfigView): Promise<PanelWriteResult> {
    void agent
    const existing = await this.readPatch()
    return this.writePatch(PanelService.mergeCoreBlock(existing.ok ? existing.raw : '', config))
  }

  /** Clear the configured prompt content, keeping the plugin installed (and any other patch lines). */
  @Remote('config-clear')
  async configClear(agent: Agent): Promise<PanelWriteResult> {
    void agent
    const existing = await this.readPatch()
    return this.writePatch(PanelService.mergeCoreBlock(existing.ok ? existing.raw : '', {
      found: true, sections: [], history: [], includeSubagents: false, historyMode: 'reapply', seedMode: 'append',
    }))
  }

  /** Import a raw patch file text wholesale. */
  @Remote('config-raw-import')
  configRawImport(agent: Agent, raw: string): Promise<PanelWriteResult> {
    void agent
    if (typeof raw !== 'string' || raw.trim() === '') {
      return Promise.resolve({ ok: false, path: '', error: 'raw content is empty; nothing written' })
    }
    return this.writePatch(raw)
  }

  /** Snapshot the captured request ring plus listener state. */
  @Remote('requests-list')
  requestsList(agent: Agent): PanelRequestsView {
    void agent
    return { requests: this.ring.slice(), paused: this.paused, dockVisible: this.dockVisible }
  }

  /** Pause or resume request capture. */
  @Remote('requests-set-paused')
  requestsSetPaused(agent: Agent, paused: boolean): PanelRequestsView {
    void agent
    this.paused = paused === true
    return { requests: this.ring.slice(), paused: this.paused, dockVisible: this.dockVisible }
  }

  /** Clear the captured request ring. */
  @Remote('requests-clear')
  requestsClear(agent: Agent): PanelRequestsView {
    void agent
    this.ring.length = 0
    this.seq = 0
    return { requests: [], paused: this.paused, dockVisible: this.dockVisible }
  }

  /** Show or hide the composer dock strip. */
  @Remote('ui-set-dock-visible')
  uiSetDockVisible(agent: Agent, visible: boolean): PanelRequestsView {
    void agent
    this.dockVisible = visible === true
    return { requests: this.ring.slice(), paused: this.paused, dockVisible: this.dockVisible }
  }

  /** Assemble this plugin's live system-prompt sections for the preview tab. */
  @Remote('preview-assemble')
  async previewAssemble(agent: Agent): Promise<PanelAssembleResult> {
    void agent
    const systemPrompt = this.ctx.get('systemPrompt') as PanelSystemPrompt | undefined
    if (systemPrompt === undefined) return { sections: [], error: 'systemPrompt service unavailable' }
    try {
      const assembly = await systemPrompt.assemble({})
      const sections = (Array.isArray(assembly?.sections) ? assembly.sections : [])
        .map(s => ({
          name: typeof s.name === 'string' ? s.name : '',
          text: typeof s.text === 'string' ? s.text : '',
          order: typeof s.order === 'number' ? s.order : 0,
        }))
        .filter(s => s.name.indexOf('custom-first-control-prompt') === 0)
      return { sections }
    } catch (error) {
      return { sections: [], error: error instanceof Error ? error.message : String(error) }
    }
  }
}
