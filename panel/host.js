// cordis_define 的 code.host 函数体（纯 JS）。
// 安装说明见 ../INSTALL.md：用本文件内容作为 code.host，panel/client.js 作为 code.client。
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const systemPrompt = ctx.get('systemPrompt')
    const settings = ctx.get('settings')
    const sandboxPolicy = ctx.get('sandboxPolicy')

    async function patchPath() {
      if (settings && typeof settings.prepareDocument === 'function') {
        try {
          const doc = await settings.prepareDocument()
          if (typeof doc === 'string' && doc.length > 0) {
            const norm = doc.replace(/\\/g, '/')
            const i = norm.lastIndexOf('/')
            if (i > 0) return norm.slice(0, i) + '/profiles/web/cordis.patch.yml'
          }
        } catch (error) {
          // fall through
        }
      }
      return null
    }

    function writePolicy() {
      if (sandboxPolicy && typeof sandboxPolicy.resolve === 'function') {
        try { return sandboxPolicy.resolve({ mode: 'danger-full-access' }) } catch (error) { return undefined }
      }
      return undefined
    }

    function yamlUnquote(s) {
      s = String(s).trim()
      if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') s = s.slice(1, -1)
      else if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") s = s.slice(1, -1)
      return s.replace(/\\\\/g, '\u0000').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\u0000/g, '\\')
    }

    function yamlScalar(s) {
      return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n') + '"'
    }

    function parseBlock(raw) {
      const out = { found: false, sections: [], history: [], includeSubagents: false, historyMode: 'reapply' }
      if (typeof raw !== 'string' || raw.indexOf('custom-first-control-prompt') < 0) return out
      out.found = true
      const lines = raw.split(/\r?\n/)
      let zone = ''
      let cur = null
      for (const line of lines) {
        const t = line.trim()
        if (t.indexOf('sections:') === 0) { zone = 'sections'; cur = null; continue }
        if (t.indexOf('history:') === 0) { zone = 'history'; cur = null; continue }
        if (t.indexOf('includeSubagents:') === 0 || t.indexOf('historyMode:') === 0) { zone = ''; cur = null }
        if (zone === 'sections') {
          if (t.indexOf('- name:') === 0) {
            cur = { name: yamlUnquote(t.slice(t.indexOf(':') + 1)), order: 0, text: '', enabled: true }
            out.sections.push(cur)
          } else if (cur !== null && t.indexOf('order:') === 0) {
            cur.order = Number(t.slice(t.indexOf(':') + 1))
          } else if (cur !== null && t.indexOf('text:') === 0) {
            cur.text = yamlUnquote(t.slice(t.indexOf(':') + 1))
          }
        } else if (zone === 'history') {
          if (t.indexOf('- user:') === 0) {
            cur = { user: yamlUnquote(t.slice(t.indexOf(':') + 1)), assistant: '' }
            out.history.push(cur)
          } else if (cur !== null && t.indexOf('assistant:') === 0) {
            cur.assistant = yamlUnquote(t.slice(t.indexOf(':') + 1))
          }
        } else if (zone === '') {
          const m = t.match(/^includeSubagents:\s*(true|false)/)
          if (m) out.includeSubagents = m[1] === 'true'
          const h = t.match(/^historyMode:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/)
          if (h) out.historyMode = h[1] || h[2] || h[3]
        }
      }
      return out
    }

    function buildPatch(cfg) {
      const sections = Array.isArray(cfg && cfg.sections) ? cfg.sections : []
      const history = Array.isArray(cfg && cfg.history) ? cfg.history : []
      const includeSubagents = cfg && cfg.includeSubagents === true
      const mode = cfg && (cfg.historyMode === 'per-request' || cfg.historyMode === 'session-start') ? cfg.historyMode : 'reapply'
      const secBlock = sections.length > 0
        ? sections.map(function (s) { return '          - name: ' + yamlScalar(s.name) + '\n            order: ' + (Number(s.order) || 0) + '\n            text: ' + yamlScalar(s.text) }).join('\n')
        : ''
      const hisBlock = history.length > 0
        ? history.map(function (p) { return '          - user: ' + yamlScalar(p.user) + '\n            assistant: ' + yamlScalar(p.assistant) }).join('\n')
        : ''
      return '# Your patch layer for this dsh profile, applied after every bundle layer:\n'
        + '# a top-level YAML array of loader patch entries (id-targeted config\n'
        + '# overrides, disables, and insert lists; `!!js` expressions allowed).\n'
        + '- insert:\n'
        + '    - id: custom-first-control-prompt\n'
        + "      name: '@deepseek-ai/dsh-custom-first-control-prompt'\n"
        + '      config:\n'
        + (sections.length > 0 ? '        sections:\n' + secBlock + '\n' : '        sections: []\n')
        + (history.length > 0 ? '        history:\n' + hisBlock + '\n' : '        history: []\n')
        + '        includeSubagents: ' + (includeSubagents ? 'true' : 'false') + '\n'
        + '        historyMode: ' + yamlScalar(mode) + '\n'
    }

    async function readPatch() {
      const path = await patchPath()
      if (path === null) return { ok: false, path: '', raw: '', parsed: parseBlock(''), error: '无法定位补丁文件路径（settings.prepareDocument() 未返回文档路径）' }
      if (!fs) return { ok: false, path, raw: '', parsed: parseBlock(''), error: 'fs service unavailable' }
      const target = await fs.resolve(path)
      try {
        const raw = await fs.readText(target)
        return { ok: true, path, raw, parsed: parseBlock(raw) }
      } catch (error) {
        return { ok: false, path, raw: '', parsed: parseBlock(''), error: String(error && error.message ? error.message : error) }
      }
    }

    async function writePatch(raw) {
      const path = await patchPath()
      if (path === null) return { ok: false, path: '', error: '无法定位补丁文件路径（settings.prepareDocument() 未返回文档路径）' }
      if (!fs) return { ok: false, path, error: 'fs service unavailable' }
      try {
        const target = await fs.resolve(path)
        await fs.writeText(target, raw, undefined, undefined, writePolicy())
        return { ok: true, path, saved: true }
      } catch (error) {
        return { ok: false, path, error: String(error && error.message ? error.message : error) }
      }
    }

    const ring = []
    let seq = 0
    let paused = true
    let dockVisible = true
    ctx.on('llm/stream', function (options, next) {
      const stream = next()
      if (paused) return stream
      try {
        const entry = { id: ++seq, time: Date.now(), model: '', provider: '', system: '', messages: [] }
        if (options && typeof options === 'object') {
          if (typeof options.model === 'string') entry.model = options.model
          if (typeof options.provider === 'string') entry.provider = options.provider
          if (typeof options.system === 'string') entry.system = options.system
          const msgs = Array.isArray(options.messages) ? options.messages : []
          entry.messages = msgs.map(function (msg) {
            let text = ''
            if (typeof msg.content === 'string') text = msg.content
            else if (Array.isArray(msg.content)) {
              text = msg.content.map(function (block) {
                if (typeof block === 'string') return block
                if (block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') return block.text
                return ''
              }).join('')
            }
            return { role: typeof msg.role === 'string' ? msg.role : 'unknown', text: text }
          })
        }
        ring.push(entry)
        if (ring.length > 30) ring.shift()
      } catch (error) {
        console.error('cfcp request capture failed: ' + (error && error.message ? error.message : error))
      }
      return stream
    })

    harness.handle('config.read', function () { return readPatch() })
    harness.handle('config.write', function (args) {
      return writePatch(buildPatch(args && typeof args === 'object' ? args.config : undefined))
    })
    harness.handle('config.clear', function () {
      return writePatch(buildPatch({ sections: [], history: [], includeSubagents: false, historyMode: 'reapply' }))
    })
    harness.handle('config.rawImport', function (args) {
      const raw = args && typeof args.raw === 'string' ? args.raw : ''
      if (raw.trim() === '') return { ok: false, error: 'raw 内容为空，未写入' }
      return writePatch(raw)
    })
    harness.handle('requests.list', function () { return { requests: ring.slice(), paused, dockVisible } })
    harness.handle('requests.setPaused', function (args) {
      paused = args && args.paused === true
      return { paused }
    })
    harness.handle('requests.clear', function () {
      ring.length = 0
      seq = 0
      return { count: 0, paused, dockVisible }
    })
    harness.handle('ui.setDockVisible', function (args) {
      dockVisible = args && args.visible === true
      return { dockVisible }
    })
    harness.handle('preview.assemble', async function () {
      if (!systemPrompt || typeof systemPrompt.assemble !== 'function') return { sections: [], error: 'systemPrompt 服务不可用' }
      try {
        const assembly = await systemPrompt.assemble({})
        const sections = (Array.isArray(assembly && assembly.sections) ? assembly.sections : [])
          .map(function (s) { return { name: typeof s.name === 'string' ? s.name : '', text: typeof s.text === 'string' ? s.text : '', order: typeof s.order === 'number' ? s.order : 0 } })
          .filter(function (s) { return s.name.indexOf('custom-first-control-prompt') === 0 })
        return { sections }
      } catch (error) {
        return { sections: [], error: String(error && error.message ? error.message : error) }
      }
    })
  },
}
