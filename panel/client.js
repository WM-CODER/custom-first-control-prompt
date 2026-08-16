// cordis_define 的 code.client 函数体（纯 JS，React 用 React.createElement，禁止 JSX）。
// 安装说明见 ../INSTALL.md：与 panel/host.js 一起定义并运行。
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    styles.insert(`
.cfcp-panel { display:flex; flex-direction:column; gap:12px; padding:4px 0; }
.cfcp-tabs { display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid var(--color-border,#ccc); padding-bottom:8px; }
.cfcp-tab { padding:6px 12px; border:1px solid var(--color-border,#ccc); border-radius:6px; background:transparent; cursor:pointer; }
.cfcp-tab.on { background:var(--color-accent,#4b7bec); color:#fff; border-color:transparent; }
.cfcp-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:4px 0; }
.cfcp-row label { min-width:90px; opacity:.8; }
.cfcp-input { flex:1; min-width:140px; padding:4px 6px; border:1px solid var(--color-border,#ccc); border-radius:4px; background:var(--color-bg,#fff); color:var(--color-text,#222); }
.cfcp-btn { padding:5px 12px; border:1px solid var(--color-border,#ccc); border-radius:6px; background:transparent; cursor:pointer; }
.cfcp-btn.primary { background:var(--color-accent,#4b7bec); color:#fff; border-color:transparent; }
.cfcp-btn.danger { border-color:#c0392b; color:#c0392b; }
.cfcp-pre { white-space:pre-wrap; word-break:break-word; font-family:ui-monospace,monospace; font-size:12px; background:var(--color-bg-dim,#f4f4f4); padding:10px; border-radius:6px; max-height:420px; overflow:auto; }
.cfcp-note { opacity:.75; font-size:12px; }
.cfcp-err { color:#c0392b; font-size:12px; }
.cfcp-card { padding:8px 0; }
.cfcp-dock { border:1px solid var(--color-border,#ccc); border-radius:8px; margin:4px 0; background:var(--color-bg,#fff); }
.cfcp-dock-head { display:flex; gap:8px; align-items:center; padding:6px 8px; }
.cfcp-dock-body { padding:0 8px 8px; display:flex; flex-direction:column; gap:8px; max-height:280px; overflow:auto; }
.cfcp-dock-item { border-top:1px dashed var(--color-border,#ccc); padding-top:6px; }
`)

    function Panel(props) {
      const [tab, setTab] = React.useState('preview')
      const [state, setState] = React.useState({ loading: true, ok: false, path: '', raw: '', config: null, error: '' })
      const [draft, setDraft] = React.useState(null)
      const [rawDraft, setRawDraft] = React.useState('')
      const [assembly, setAssembly] = React.useState({ sections: [] })
      const [notice, setNotice] = React.useState('')
      const [confirmClear, setConfirmClear] = React.useState(false)

      function reload() {
        host.call('config.read').then(function (r) {
          setState({ loading: false, ok: !!r.ok, path: r.path || '', raw: typeof r.raw === 'string' ? r.raw : '', config: r.parsed || null, error: r.error || '' })
          if (r.ok && r.parsed) setDraft(JSON.parse(JSON.stringify(r.parsed)))
          if (typeof r.raw === 'string') setRawDraft(r.raw)
        })
      }
      function loadAssembly() { host.call('preview.assemble').then(function (r) { setAssembly(r && r.sections ? { sections: r.sections } : { sections: [] }) }) }
      React.useEffect(function () { reload(); loadAssembly() }, [])

      const tabs = [['preview', '预览'], ['config', '配置编辑'], ['requests', 'LLM 监听'], ['raw', 'RAW']]
      return React.createElement('div', { className: 'cfcp-panel' },
        React.createElement('div', { className: 'cfcp-tabs' },
          tabs.map(function (t) {
            return React.createElement('button', { key: t[0], className: 'cfcp-tab' + (tab === t[0] ? ' on' : ''), onClick: function () { setTab(t[0]) } }, t[1])
          }),
        ),
        notice ? React.createElement('div', { className: 'cfcp-note' }, notice) : null,
        tab === 'preview' ? React.createElement(PreviewTab, { state, assembly }) : null,
        tab === 'config' ? React.createElement(ConfigTab, { state, draft, setDraft, confirmClear, setConfirmClear, reload, setNotice }) : null,
        tab === 'requests' ? React.createElement(RequestsTab, null) : null,
        tab === 'raw' ? React.createElement(RawTab, { state, rawDraft, setRawDraft, reload, setNotice }) : null,
      )
    }

    function PreviewTab(props) {
      const [dockVisible, setDockVisible] = React.useState(true)
      React.useEffect(function () {
        host.call('requests.list').then(function (r) { if (r && typeof r.dockVisible === 'boolean') setDockVisible(r.dockVisible) })
      }, [])
      function toggleDock() {
        const next = !dockVisible
        host.call('ui.setDockVisible', { visible: next }).then(function () { setDockVisible(next) })
      }
      const cfg = props.state.config
      const sections = cfg && Array.isArray(cfg.sections) ? cfg.sections : []
      const history = cfg && Array.isArray(cfg.history) ? cfg.history : []
      return React.createElement('div', null,
        React.createElement('h4', null, '界面'),
        React.createElement('div', { className: 'cfcp-row' },
          React.createElement('input', { type: 'checkbox', checked: dockVisible, onChange: toggleDock }),
          React.createElement('span', null, '显示输入框上方条状 inspector（LLM 请求监听）'),
        ),
        React.createElement('h4', null, '已配置区段 (sections)'),
        sections.length === 0 ? React.createElement('div', { className: 'cfcp-note' }, '（无）')
          : sections.map(function (s, i) { return React.createElement('div', { key: i, className: 'cfcp-row' }, React.createElement('code', null, s.name), ' order=' + s.order, React.createElement('span', { className: 'cfcp-note' }, s.text)) }),
        React.createElement('h4', null, '参考历史 (history)'),
        history.length === 0 ? React.createElement('div', { className: 'cfcp-note' }, '（无）')
          : history.map(function (p, i) { return React.createElement('div', { key: i, className: 'cfcp-row' }, React.createElement('b', null, 'user: '), p.user, React.createElement('b', null, ' assistant: '), p.assistant) }),
        React.createElement('h4', null, '模式'),
        React.createElement('div', { className: 'cfcp-row' }, 'historyMode = ' + (cfg && cfg.historyMode) + '  includeSubagents = ' + (cfg && cfg.includeSubagents === true ? 'true' : 'false')),
        React.createElement('h4', null, '实际组装进系统提示词的区段'),
        (props.assembly.sections || []).length === 0 ? React.createElement('div', { className: 'cfcp-note' }, '（当前组装结果中无 custom-first-control-prompt 区段）')
          : props.assembly.sections.map(function (s, i) { return React.createElement('div', { key: i, className: 'cfcp-row' }, React.createElement('code', null, s.name), React.createElement('pre', { className: 'cfcp-pre' }, s.text)) }),
        React.createElement('div', { className: 'cfcp-note' }, '补丁文件: ' + props.state.path),
      )
    }

    function ConfigTab(props) {
      if (props.state.loading) return React.createElement('div', { className: 'cfcp-note' }, '读取中…')
      if (!props.state.ok) return React.createElement('div', null, React.createElement('div', { className: 'cfcp-err' }, '读取失败: ' + (props.state.error || '未知错误')), React.createElement('button', { className: 'cfcp-btn', onClick: props.reload }, '重试'))
      const d = props.draft
      if (!d) return null
      function update(fn) { const next = JSON.parse(JSON.stringify(d)); fn(next); props.setDraft(next) }
      return React.createElement('div', null,
        React.createElement('h4', null, '区段'),
        d.sections.map(function (s, i) {
          return React.createElement('div', { key: i, className: 'cfcp-row' },
            React.createElement('input', { className: 'cfcp-input', value: s.name, placeholder: 'name', onChange: function (e) { update(function (n) { n.sections[i].name = e.target.value }) } }),
            React.createElement('input', { className: 'cfcp-input', type: 'number', value: s.order, placeholder: 'order', onChange: function (e) { update(function (n) { n.sections[i].order = Number(e.target.value) }) } }),
            React.createElement('input', { className: 'cfcp-input', value: s.text, placeholder: 'text', onChange: function (e) { update(function (n) { n.sections[i].text = e.target.value }) } }),
            React.createElement('button', { className: 'cfcp-btn danger', onClick: function () { update(function (n) { n.sections.splice(i, 1) }) } }, '删除'),
          )
        }),
        React.createElement('button', { className: 'cfcp-btn', onClick: function () { update(function (n) { n.sections.push({ name: '', order: 0, text: '', enabled: true }) }) } }, '+ 添加区段'),
        React.createElement('h4', null, '参考历史'),
        d.history.map(function (p, i) {
          return React.createElement('div', { key: i, className: 'cfcp-row' },
            React.createElement('input', { className: 'cfcp-input', value: p.user, placeholder: 'user', onChange: function (e) { update(function (n) { n.history[i].user = e.target.value }) } }),
            React.createElement('input', { className: 'cfcp-input', value: p.assistant, placeholder: 'assistant', onChange: function (e) { update(function (n) { n.history[i].assistant = e.target.value }) } }),
            React.createElement('button', { className: 'cfcp-btn danger', onClick: function () { update(function (n) { n.history.splice(i, 1) }) } }, '删除'),
          )
        }),
        React.createElement('button', { className: 'cfcp-btn', onClick: function () { update(function (n) { n.history.push({ user: '', assistant: '' }) }) } }, '+ 添加历史对'),
        React.createElement('div', { className: 'cfcp-row' },
          React.createElement('label', null, 'historyMode'),
          React.createElement('select', { className: 'cfcp-input', value: d.historyMode, onChange: function (e) { update(function (n) { n.historyMode = e.target.value }) } },
            React.createElement('option', { value: 'reapply' }, 'reapply'),
            React.createElement('option', { value: 'per-request' }, 'per-request'),
            React.createElement('option', { value: 'session-start' }, 'session-start'),
          ),
        ),
        React.createElement('div', { className: 'cfcp-row' },
          React.createElement('label', null, 'includeSubagents'),
          React.createElement('input', { type: 'checkbox', checked: d.includeSubagents === true, onChange: function (e) { update(function (n) { n.includeSubagents = e.target.checked }) } }),
        ),
        React.createElement('div', { className: 'cfcp-row' },
          React.createElement('button', { className: 'cfcp-btn primary', onClick: function () {
            host.call('config.write', { config: d }).then(function (r) {
              if (r && r.ok) { props.setNotice('已保存，热重载后生效（几秒内）'); props.reload() } else { props.setNotice('保存失败: ' + (r && r.error ? r.error : '未知')) }
            })
          } }, '保存配置'),
          React.createElement('button', { className: 'cfcp-btn danger', onClick: function () {
            if (!props.confirmClear) { props.setConfirmClear(true); return }
            host.call('config.clear').then(function (r) {
              props.setConfirmClear(false)
              if (r && r.ok) { props.setNotice('已清空提示词配置（插件保持安装但不再注入）'); props.reload() } else { props.setNotice('清空失败: ' + (r && r.error ? r.error : '未知')) }
            })
          } }, props.confirmClear ? '确认清空？再点一次执行' : '清空提示词配置'),
        ),
      )
    }

    function RequestsTab() {
      const [requests, setRequests] = React.useState([])
      const [paused, setPaused] = React.useState(true)
      const timer = ctx.get('timer')
      function load() {
        host.call('requests.list').then(function (r) {
          setRequests(r && Array.isArray(r.requests) ? r.requests : [])
          if (r && typeof r.paused === 'boolean') setPaused(r.paused)
        })
      }
      React.useEffect(function () {
        load()
        if (timer === undefined) return
        const dispose = timer.interval(load, 2000)
        return dispose
      }, [])
      function togglePause() {
        const next = !paused
        host.call('requests.setPaused', { paused: next }).then(function () { setPaused(next) })
      }
      function clearAll() { host.call('requests.clear').then(load) }
      return React.createElement('div', null,
        React.createElement('div', { className: 'cfcp-row' },
          React.createElement('button', { className: 'cfcp-btn' + (paused ? ' primary' : ' danger'), onClick: togglePause }, paused ? '开始监听' : '停止监听'),
          React.createElement('button', { className: 'cfcp-btn', onClick: clearAll }, '清空'),
          React.createElement('button', { className: 'cfcp-btn', onClick: load }, '刷新'),
          React.createElement('span', { className: 'cfcp-note' }, paused ? '监听未开启（默认关闭）' : '监听中 · 最近 30 条 · 每 2 秒自动刷新'),
        ),
        requests.length === 0 ? React.createElement('div', { className: 'cfcp-note' }, paused ? '暂无记录：点击「开始监听」后采集新的 LLM 请求' : '暂无请求记录')
          : requests.map(function (r) {
            return React.createElement('div', { key: r.id, style: { margin: '10px 0' } },
              React.createElement('div', { className: 'cfcp-note' }, '#' + r.id + ' · ' + new Date(r.time).toLocaleTimeString() + ' · ' + (r.provider || '-') + '/' + (r.model || '-')),
              r.system ? React.createElement('pre', { className: 'cfcp-pre' }, '[system]\n' + r.system) : null,
              r.messages.map(function (m, i) { return React.createElement('pre', { key: i, className: 'cfcp-pre' }, '[' + m.role + ']\n' + m.text) }),
            )
          }),
      )
    }

    function RawTab(props) {
      return React.createElement('div', null,
        React.createElement('div', { className: 'cfcp-note' }, '文件: ' + props.state.path + '（textarea 即导出：全选复制即可）'),
        React.createElement('textarea', { className: 'cfcp-input', style: { width: '100%', minHeight: 320, fontFamily: 'ui-monospace,monospace', fontSize: 12 }, value: props.rawDraft, onChange: function (e) { props.setRawDraft(e.target.value) } }),
        React.createElement('div', { className: 'cfcp-row' },
          React.createElement('button', { className: 'cfcp-btn', onClick: props.reload }, '重新读取'),
          React.createElement('button', { className: 'cfcp-btn primary', onClick: function () {
            host.call('config.rawImport', { raw: props.rawDraft }).then(function (r) {
              if (r && r.ok) { props.setNotice('RAW 已导入，热重载后生效'); props.reload() } else { props.setNotice('导入失败: ' + (r && r.error ? r.error : '未知')) }
            })
          } }, '导入此内容'),
        ),
      )
    }

    function Card() {
      const [info, setInfo] = React.useState(null)
      React.useEffect(function () {
        host.call('config.read').then(function (r) { setInfo(r && r.parsed ? r.parsed : { found: false }) })
      }, [])
      const sections = info && Array.isArray(info.sections) ? info.sections : []
      const history = info && Array.isArray(info.history) ? info.history : []
      return React.createElement('div', { className: 'cfcp-card' },
        React.createElement('div', { className: 'cfcp-note' }, '@deepseek-ai/dsh-custom-first-control-prompt'),
        React.createElement('div', null, '区段 ' + sections.length + ' · 历史对 ' + history.length + ' · ' + (info && info.historyMode ? info.historyMode : 'reapply')),
        React.createElement('div', { className: 'cfcp-note' }, info && info.found ? '已安装并注入中。完整管理面板：设置 → 提示词注入' : '补丁中未找到该插件条目（未安装）'),
      )
    }

    function Dock() {
      const [expanded, setExpanded] = React.useState(true)
      const [paused, setPaused] = React.useState(true)
      const [dockVisible, setDockVisible] = React.useState(true)
      const [requests, setRequests] = React.useState([])
      const timer = ctx.get('timer')
      function load() {
        host.call('requests.list').then(function (r) {
          setRequests(r && Array.isArray(r.requests) ? r.requests : [])
          if (r && typeof r.paused === 'boolean') setPaused(r.paused)
          if (r && typeof r.dockVisible === 'boolean') setDockVisible(r.dockVisible)
        })
      }
      React.useEffect(function () {
        load()
        if (timer === undefined) return
        const dispose = timer.interval(load, 1500)
        return dispose
      }, [])
      function togglePause() {
        const next = !paused
        host.call('requests.setPaused', { paused: next }).then(function () { setPaused(next) })
      }
      function clearAll() { host.call('requests.clear').then(load) }
      if (dockVisible === false) return null
      const latest = requests.slice(-5).reverse()
      return React.createElement('div', { className: 'cfcp-dock' },
        React.createElement('div', { className: 'cfcp-dock-head' },
          React.createElement('button', { className: 'cfcp-btn', onClick: function () { setExpanded(!expanded) } }, expanded ? '收起 ▼' : '展开 ▶'),
          React.createElement('b', null, 'LLM 请求监听'),
          React.createElement('span', { className: 'cfcp-note' }, '共 ' + requests.length + ' 条 · ' + (paused ? '已停止' : '监听中')),
          React.createElement('button', { className: 'cfcp-btn' + (paused ? ' primary' : ' danger'), onClick: togglePause }, paused ? '开始监听' : '停止监听'),
          React.createElement('button', { className: 'cfcp-btn', onClick: clearAll }, '清空'),
        ),
        expanded ? React.createElement('div', { className: 'cfcp-dock-body' },
          requests.length === 0 ? React.createElement('div', { className: 'cfcp-note' }, paused ? '监听未开启：点击「开始监听」后采集新的 LLM 请求' : '暂无请求记录')
            : latest.map(function (r) {
              return React.createElement('div', { key: r.id, className: 'cfcp-dock-item' },
                React.createElement('div', { className: 'cfcp-note' }, '#' + r.id + ' · ' + new Date(r.time).toLocaleTimeString() + ' · ' + (r.provider || '-') + '/' + (r.model || '-')),
                r.system ? React.createElement('pre', { className: 'cfcp-pre' }, '[system]\n' + r.system) : null,
                r.messages.map(function (m, i) { return React.createElement('pre', { key: i, className: 'cfcp-pre' }, '[' + m.role + ']\n' + m.text) }),
              )
            }),
        ) : null,
      )
    }

    slots.inject('conversation.input.dock', function () {
      return slots.register(
        { name: 'conversation.input.dock', id: 'cfcp-llm-console', order: 5, label: function () { return 'LLM 请求监听' } },
        function () { return React.createElement(Dock, null) },
      )
    })
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'cfcp-prompt', order: 5, label: function () { return '提示词注入' } },
        function (props) { return React.createElement(Panel, { close: props && typeof props.close === 'function' ? props.close : undefined }) },
      )
    })
    slots.inject('settings.plugin.item', function () {
      return slots.register(
        { name: 'settings.plugin.item', id: 'custom-first-control-prompt', order: 5, label: function () { return '@deepseek-ai/dsh-custom-first-control-prompt' } },
        function () { return React.createElement(Card, null) },
      )
    })
    slots.inject('tool.view.cordis', function () {
      return slots.register(
        { name: 'tool.view.cordis', key: 'self' },
        function () { return React.createElement('div', null, React.createElement('div', { className: 'cfcp-note' }, 'custom-first-control-prompt 管理面板（完整页面：设置 → 提示词注入）'), React.createElement(Panel, null)) },
      )
    })
  },
}
