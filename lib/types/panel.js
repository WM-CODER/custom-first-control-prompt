var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
/** Service key: the client reaches these methods as `ctx.remote['custom-first-control-prompt-panel']`. */
export const PANEL_SERVICE_KEY = 'custom-first-control-prompt-panel';
/** The web panel management service. */
let PanelService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _configRead_decorators;
    let _configWrite_decorators;
    let _configClear_decorators;
    let _configRawImport_decorators;
    let _requestsList_decorators;
    let _requestsSetPaused_decorators;
    let _requestsClear_decorators;
    let _uiSetDockVisible_decorators;
    let _previewAssemble_decorators;
    return class PanelService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _configRead_decorators = [Remote('config-read')];
            _configWrite_decorators = [Remote('config-write')];
            _configClear_decorators = [Remote('config-clear')];
            _configRawImport_decorators = [Remote('config-raw-import')];
            _requestsList_decorators = [Remote('requests-list')];
            _requestsSetPaused_decorators = [Remote('requests-set-paused')];
            _requestsClear_decorators = [Remote('requests-clear')];
            _uiSetDockVisible_decorators = [Remote('ui-set-dock-visible')];
            _previewAssemble_decorators = [Remote('preview-assemble')];
            __esDecorate(this, null, _configRead_decorators, { kind: "method", name: "configRead", static: false, private: false, access: { has: obj => "configRead" in obj, get: obj => obj.configRead }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _configWrite_decorators, { kind: "method", name: "configWrite", static: false, private: false, access: { has: obj => "configWrite" in obj, get: obj => obj.configWrite }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _configClear_decorators, { kind: "method", name: "configClear", static: false, private: false, access: { has: obj => "configClear" in obj, get: obj => obj.configClear }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _configRawImport_decorators, { kind: "method", name: "configRawImport", static: false, private: false, access: { has: obj => "configRawImport" in obj, get: obj => obj.configRawImport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _requestsList_decorators, { kind: "method", name: "requestsList", static: false, private: false, access: { has: obj => "requestsList" in obj, get: obj => obj.requestsList }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _requestsSetPaused_decorators, { kind: "method", name: "requestsSetPaused", static: false, private: false, access: { has: obj => "requestsSetPaused" in obj, get: obj => obj.requestsSetPaused }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _requestsClear_decorators, { kind: "method", name: "requestsClear", static: false, private: false, access: { has: obj => "requestsClear" in obj, get: obj => obj.requestsClear }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _uiSetDockVisible_decorators, { kind: "method", name: "uiSetDockVisible", static: false, private: false, access: { has: obj => "uiSetDockVisible" in obj, get: obj => obj.uiSetDockVisible }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _previewAssemble_decorators, { kind: "method", name: "previewAssemble", static: false, private: false, access: { has: obj => "previewAssemble" in obj, get: obj => obj.previewAssemble }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        ring = (__runInitializers(this, _instanceExtraInitializers), []);
        seq = 0;
        paused = true;
        dockVisible = true;
        constructor(ctx) {
            super(ctx, 'custom-first-control-prompt-panel');
            ctx.on('llm/stream', (options, next) => {
                const stream = next();
                if (!this.paused)
                    this.capture(options);
                return stream;
            });
        }
        // ---- capture ----
        capture(options) {
            try {
                const record = options;
                const entry = {
                    id: ++this.seq,
                    time: Date.now(),
                    model: typeof record['model'] === 'string' ? record['model'] : '',
                    provider: typeof record['provider'] === 'string' ? record['provider'] : '',
                    system: typeof record['system'] === 'string' ? record['system'] : '',
                    messages: [],
                };
                const msgs = Array.isArray(record['messages']) ? record['messages'] : [];
                entry.messages = msgs.map((msg) => {
                    let text = '';
                    const m = typeof msg === 'object' && msg !== null ? msg : undefined;
                    if (typeof m?.['content'] === 'string')
                        text = m['content'];
                    else if (Array.isArray(m?.['content'])) {
                        text = m['content'].map(block => {
                            if (typeof block === 'string')
                                return block;
                            const b = typeof block === 'object' && block !== null ? block : undefined;
                            return b?.['type'] === 'text' && typeof b['text'] === 'string' ? b['text'] : '';
                        }).join('');
                    }
                    return { role: typeof m?.['role'] === 'string' ? m['role'] : 'unknown', text };
                });
                this.ring.push(entry);
                if (this.ring.length > 30)
                    this.ring.shift();
            }
            catch (error) {
                this.ctx.logger?.warn('custom-first-control-prompt panel request capture failed: %s', String(error));
            }
        }
        // ---- patch file plumbing ----
        async patchPath() {
            const settings = this.ctx.get('settings');
            if (settings !== undefined) {
                try {
                    const doc = await settings.prepareDocument();
                    if (typeof doc === 'string' && doc.length > 0) {
                        const norm = doc.replace(/\\/g, '/');
                        const i = norm.lastIndexOf('/');
                        if (i > 0)
                            return `${norm.slice(0, i)}/profiles/web/cordis.patch.yml`;
                    }
                }
                catch {
                    // fall through to the explicit failure below
                }
            }
            return null;
        }
        writePolicy() {
            const policy = this.ctx.get('sandboxPolicy');
            try {
                return policy?.resolve({ mode: 'danger-full-access' });
            }
            catch {
                return undefined;
            }
        }
        static yamlUnquote(value) {
            let s = value.trim();
            if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"')
                s = s.slice(1, -1);
            else if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'")
                s = s.slice(1, -1);
            return s.replace(/\\\\/g, '\u0000').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\u0000/g, '\\');
        }
        static yamlScalar(value) {
            return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;
        }
        static parseBlock(raw) {
            const out = { found: false, sections: [], history: [], includeSubagents: false, historyMode: 'reapply', seedMode: 'hook' };
            if (raw.indexOf('custom-first-control-prompt') < 0)
                return out;
            out.found = true;
            let zone = '';
            let cur = null;
            for (const line of raw.split(/\r?\n/)) {
                const t = line.trim();
                if (t.indexOf('sections:') === 0) {
                    zone = 'sections';
                    cur = null;
                    continue;
                }
                if (t.indexOf('history:') === 0) {
                    zone = 'history';
                    cur = null;
                    continue;
                }
                if (t.indexOf('includeSubagents:') === 0 || t.indexOf('historyMode:') === 0 || t.indexOf('seedMode:') === 0) {
                    zone = '';
                    cur = null;
                }
                if (zone === 'sections') {
                    if (t.indexOf('- name:') === 0) {
                        cur = { name: PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1)), order: 0, text: '', enabled: true };
                        out.sections.push(cur);
                    }
                    else if (cur !== null && 'name' in cur && t.indexOf('order:') === 0) {
                        cur.order = Number(t.slice(t.indexOf(':') + 1));
                    }
                    else if (cur !== null && 'name' in cur && t.indexOf('text:') === 0) {
                        cur.text = PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1));
                    }
                }
                else if (zone === 'history') {
                    if (t.indexOf('- user:') === 0) {
                        cur = { user: PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1)), assistant: '' };
                        out.history.push(cur);
                    }
                    else if (cur !== null && 'assistant' in cur && t.indexOf('assistant:') === 0) {
                        cur.assistant = PanelService.yamlUnquote(t.slice(t.indexOf(':') + 1));
                    }
                }
                else if (zone === '') {
                    const m = t.match(/^includeSubagents:\s*(true|false)/);
                    if (m)
                        out.includeSubagents = m[1] === 'true';
                    const h = t.match(/^historyMode:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/);
                    if (h)
                        out.historyMode = h[1] ?? h[2] ?? h[3] ?? 'reapply';
                    const sm = t.match(/^seedMode:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/);
                    if (sm)
                        out.seedMode = sm[1] ?? sm[2] ?? sm[3] ?? 'hook';
                }
            }
            return out;
        }
        static buildPatch(config) {
            const sections = Array.isArray(config?.sections) ? config.sections : [];
            const history = Array.isArray(config?.history) ? config.history : [];
            const includeSubagents = config?.includeSubagents === true;
            const mode = config?.historyMode === 'per-request' || config?.historyMode === 'session-start'
                ? config.historyMode
                : 'reapply';
            const seedMode = config?.seedMode === 'append' ? 'append' : 'hook';
            const secBlock = sections.length > 0
                ? sections.map(s => `          - name: ${PanelService.yamlScalar(s.name)}\n            order: ${Number(s.order) || 0}\n            text: ${PanelService.yamlScalar(s.text)}`).join('\n')
                : '';
            const hisBlock = history.length > 0
                ? history.map(p => `          - user: ${PanelService.yamlScalar(p.user)}\n            assistant: ${PanelService.yamlScalar(p.assistant)}`).join('\n')
                : '';
            return '# Your patch layer for this dsh profile, applied after every bundle layer:\n'
                + '# a top-level YAML array of loader patch entries (id-targeted config\n'
                + '# overrides, disables, and insert lists; `!!js` expressions allowed).\n'
                + '- insert:\n'
                + '    - id: custom-first-control-prompt\n'
                + "      name: '@deepseek-ai/dsh-custom-first-control-prompt'\n"
                + '      config:\n'
                + (sections.length > 0 ? `        sections:\n${secBlock}\n` : '        sections: []\n')
                + (history.length > 0 ? `        history:\n${hisBlock}\n` : '        history: []\n')
                + `        includeSubagents: ${includeSubagents ? 'true' : 'false'}\n`
                + `        historyMode: ${PanelService.yamlScalar(mode)}\n`
                + `        seedMode: ${PanelService.yamlScalar(seedMode)}\n`;
        }
        async readPatch() {
            const path = await this.patchPath();
            if (path === null) {
                return { ok: false, path: '', raw: '', parsed: PanelService.parseBlock(''), error: 'unable to locate the profile patch file (settings.prepareDocument() returned no path)' };
            }
            const fs = this.ctx.get('fs');
            if (fs === undefined)
                return { ok: false, path, raw: '', parsed: PanelService.parseBlock(''), error: 'fs service unavailable' };
            try {
                const target = await fs.resolve(path);
                const raw = await fs.readText(target);
                return { ok: true, path, raw, parsed: PanelService.parseBlock(raw), error: '' };
            }
            catch (error) {
                return { ok: false, path, raw: '', parsed: PanelService.parseBlock(''), error: error instanceof Error ? error.message : String(error) };
            }
        }
        async writePatch(raw) {
            const path = await this.patchPath();
            if (path === null) {
                return { ok: false, path: '', error: 'unable to locate the profile patch file (settings.prepareDocument() returned no path)' };
            }
            const fs = this.ctx.get('fs');
            if (fs === undefined)
                return { ok: false, path, error: 'fs service unavailable' };
            try {
                const target = await fs.resolve(path);
                await fs.writeText(target, raw, undefined, undefined, this.writePolicy());
                return { ok: true, path, saved: true, error: '' };
            }
            catch (error) {
                return { ok: false, path, error: error instanceof Error ? error.message : String(error) };
            }
        }
        // ---- Remote surface (the gateway prepends the live Agent authority) ----
        /** Read the profile patch entry. */
        configRead(agent) {
            void agent;
            return this.readPatch();
        }
        /** Write the profile patch entry regenerated from the panel's config view. */
        configWrite(agent, config) {
            void agent;
            return this.writePatch(PanelService.buildPatch(config));
        }
        /** Clear the configured prompt content, keeping the plugin installed. */
        configClear(agent) {
            void agent;
            return this.writePatch(PanelService.buildPatch({ found: true, sections: [], history: [], includeSubagents: false, historyMode: 'reapply', seedMode: 'hook' }));
        }
        /** Import a raw patch file text wholesale. */
        configRawImport(agent, raw) {
            void agent;
            if (typeof raw !== 'string' || raw.trim() === '') {
                return Promise.resolve({ ok: false, path: '', error: 'raw content is empty; nothing written' });
            }
            return this.writePatch(raw);
        }
        /** Snapshot the captured request ring plus listener state. */
        requestsList(agent) {
            void agent;
            return { requests: this.ring.slice(), paused: this.paused, dockVisible: this.dockVisible };
        }
        /** Pause or resume request capture. */
        requestsSetPaused(agent, paused) {
            void agent;
            this.paused = paused === true;
            return { requests: this.ring.slice(), paused: this.paused, dockVisible: this.dockVisible };
        }
        /** Clear the captured request ring. */
        requestsClear(agent) {
            void agent;
            this.ring.length = 0;
            this.seq = 0;
            return { requests: [], paused: this.paused, dockVisible: this.dockVisible };
        }
        /** Show or hide the composer dock strip. */
        uiSetDockVisible(agent, visible) {
            void agent;
            this.dockVisible = visible === true;
            return { requests: this.ring.slice(), paused: this.paused, dockVisible: this.dockVisible };
        }
        /** Assemble this plugin's live system-prompt sections for the preview tab. */
        async previewAssemble(agent) {
            void agent;
            const systemPrompt = this.ctx.get('systemPrompt');
            if (systemPrompt === undefined)
                return { sections: [], error: 'systemPrompt service unavailable' };
            try {
                const assembly = await systemPrompt.assemble({});
                const sections = (Array.isArray(assembly?.sections) ? assembly.sections : [])
                    .map(s => ({
                    name: typeof s.name === 'string' ? s.name : '',
                    text: typeof s.text === 'string' ? s.text : '',
                    order: typeof s.order === 'number' ? s.order : 0,
                }))
                    .filter(s => s.name.indexOf('custom-first-control-prompt') === 0);
                return { sections };
            }
            catch (error) {
                return { sections: [], error: error instanceof Error ? error.message : String(error) };
            }
        }
    };
})();
export { PanelService };
//# sourceMappingURL=panel.js.map