import { a as TRANSCRIPT_RESERVED_TAGS, c as buildSeedEvents, d as isSeededByPlugin, f as seedTranscript, l as buildSeedMessages, o as appendSeedTurns, p as seededMessageSource, s as buildHistoryMessage, u as hasSeededHistory } from "./seed-C0hjxpZj.js";
import z from "@deepseek-ai/schemastery";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region src/panel.ts
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
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
			_configRead_decorators = [Remote("config-read")];
			_configWrite_decorators = [Remote("config-write")];
			_configClear_decorators = [Remote("config-clear")];
			_configRawImport_decorators = [Remote("config-raw-import")];
			_requestsList_decorators = [Remote("requests-list")];
			_requestsSetPaused_decorators = [Remote("requests-set-paused")];
			_requestsClear_decorators = [Remote("requests-clear")];
			_uiSetDockVisible_decorators = [Remote("ui-set-dock-visible")];
			_previewAssemble_decorators = [Remote("preview-assemble")];
			__esDecorate(this, null, _configRead_decorators, {
				kind: "method",
				name: "configRead",
				static: false,
				private: false,
				access: {
					has: (obj) => "configRead" in obj,
					get: (obj) => obj.configRead
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _configWrite_decorators, {
				kind: "method",
				name: "configWrite",
				static: false,
				private: false,
				access: {
					has: (obj) => "configWrite" in obj,
					get: (obj) => obj.configWrite
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _configClear_decorators, {
				kind: "method",
				name: "configClear",
				static: false,
				private: false,
				access: {
					has: (obj) => "configClear" in obj,
					get: (obj) => obj.configClear
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _configRawImport_decorators, {
				kind: "method",
				name: "configRawImport",
				static: false,
				private: false,
				access: {
					has: (obj) => "configRawImport" in obj,
					get: (obj) => obj.configRawImport
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _requestsList_decorators, {
				kind: "method",
				name: "requestsList",
				static: false,
				private: false,
				access: {
					has: (obj) => "requestsList" in obj,
					get: (obj) => obj.requestsList
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _requestsSetPaused_decorators, {
				kind: "method",
				name: "requestsSetPaused",
				static: false,
				private: false,
				access: {
					has: (obj) => "requestsSetPaused" in obj,
					get: (obj) => obj.requestsSetPaused
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _requestsClear_decorators, {
				kind: "method",
				name: "requestsClear",
				static: false,
				private: false,
				access: {
					has: (obj) => "requestsClear" in obj,
					get: (obj) => obj.requestsClear
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _uiSetDockVisible_decorators, {
				kind: "method",
				name: "uiSetDockVisible",
				static: false,
				private: false,
				access: {
					has: (obj) => "uiSetDockVisible" in obj,
					get: (obj) => obj.uiSetDockVisible
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _previewAssemble_decorators, {
				kind: "method",
				name: "previewAssemble",
				static: false,
				private: false,
				access: {
					has: (obj) => "previewAssemble" in obj,
					get: (obj) => obj.previewAssemble
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		ring = (__runInitializers(this, _instanceExtraInitializers), []);
		seq = 0;
		paused = true;
		dockVisible = true;
		constructor(ctx) {
			super(ctx, "custom-first-control-prompt-panel");
			ctx.on("llm/stream", (options, next) => {
				const stream = next();
				if (!this.paused) this.capture(options);
				return stream;
			});
		}
		capture(options) {
			try {
				const record = options;
				const entry = {
					id: ++this.seq,
					time: Date.now(),
					model: typeof record["model"] === "string" ? record["model"] : "",
					provider: typeof record["provider"] === "string" ? record["provider"] : "",
					system: typeof record["system"] === "string" ? record["system"] : "",
					purpose: typeof record["purpose"] === "string" ? record["purpose"] : "",
					messages: []
				};
				entry.messages = (Array.isArray(record["messages"]) ? record["messages"] : []).map((msg) => {
					let text = "";
					const m = typeof msg === "object" && msg !== null ? msg : void 0;
					if (typeof m?.["content"] === "string") text = m["content"];
					else if (Array.isArray(m?.["content"])) text = m["content"].map((block) => {
						if (typeof block === "string") return block;
						const b = typeof block === "object" && block !== null ? block : void 0;
						return b?.["type"] === "text" && typeof b["text"] === "string" ? b["text"] : "";
					}).join("");
					return {
						role: typeof m?.["role"] === "string" ? m["role"] : "unknown",
						text
					};
				});
				this.ring.push(entry);
				if (this.ring.length > 30) this.ring.shift();
			} catch (error) {
				this.ctx.logger?.warn("custom-first-control-prompt panel request capture failed: %s", String(error));
			}
		}
		async patchPath() {
			const settings = this.ctx.get("settings");
			if (settings !== void 0) try {
				const doc = await settings.prepareDocument();
				if (typeof doc === "string" && doc.length > 0) {
					const norm = doc.replace(/\\/g, "/");
					const i = norm.lastIndexOf("/");
					if (i > 0) return `${norm.slice(0, i)}/profiles/web/cordis.patch.yml`;
				}
			} catch {}
			return null;
		}
		writePolicy() {
			const policy = this.ctx.get("sandboxPolicy");
			try {
				return policy?.resolve({ mode: "danger-full-access" });
			} catch {
				return;
			}
		}
		static yamlUnquote(value) {
			let s = value.trim();
			if (s.length >= 2 && s[0] === "\"" && s[s.length - 1] === "\"") s = s.slice(1, -1);
			else if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") s = s.slice(1, -1);
			return s.replace(/\\\\/g, "\0").replace(/\\n/g, "\n").replace(/\\"/g, "\"").replace(/\u0000/g, "\\");
		}
		static yamlScalar(value) {
			return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\r?\n/g, "\\n")}"`;
		}
		static parseBlock(raw) {
			const out = {
				found: false,
				sections: [],
				history: [],
				includeSubagents: false,
				historyMode: "reapply",
				seedMode: "append"
			};
			if (raw.indexOf("custom-first-control-prompt") < 0) return out;
			out.found = true;
			let zone = "";
			let cur = null;
			for (const line of raw.split(/\r?\n/)) {
				const t = line.trim();
				if (t.indexOf("sections:") === 0) {
					zone = "sections";
					cur = null;
					continue;
				}
				if (t.indexOf("history:") === 0) {
					zone = "history";
					cur = null;
					continue;
				}
				if (t.indexOf("includeSubagents:") === 0 || t.indexOf("historyMode:") === 0 || t.indexOf("seedMode:") === 0) {
					zone = "";
					cur = null;
				}
				if (zone === "sections") {
					if (t.indexOf("- name:") === 0) {
						cur = {
							name: PanelService.yamlUnquote(t.slice(t.indexOf(":") + 1)),
							order: 0,
							text: "",
							enabled: true
						};
						out.sections.push(cur);
					} else if (cur !== null && "name" in cur && t.indexOf("order:") === 0) cur.order = Number(t.slice(t.indexOf(":") + 1));
					else if (cur !== null && "name" in cur && t.indexOf("text:") === 0) cur.text = PanelService.yamlUnquote(t.slice(t.indexOf(":") + 1));
				} else if (zone === "history") {
					if (t.indexOf("- user:") === 0) {
						cur = {
							user: PanelService.yamlUnquote(t.slice(t.indexOf(":") + 1)),
							assistant: ""
						};
						out.history.push(cur);
					} else if (cur !== null && "assistant" in cur && t.indexOf("assistant:") === 0) cur.assistant = PanelService.yamlUnquote(t.slice(t.indexOf(":") + 1));
				} else if (zone === "") {
					const m = t.match(/^includeSubagents:\s*(true|false)/);
					if (m) out.includeSubagents = m[1] === "true";
					const h = t.match(/^historyMode:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/);
					if (h) out.historyMode = h[1] ?? h[2] ?? h[3] ?? "reapply";
					const sm = t.match(/^seedMode:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/);
					if (sm) out.seedMode = sm[1] ?? sm[2] ?? sm[3] ?? "hook";
				}
			}
			return out;
		}
		/** Render just the core `custom-first-control-prompt` loader row (4-space indent block). */
		static coreBlock(config) {
			const sections = Array.isArray(config?.sections) ? config.sections : [];
			const history = Array.isArray(config?.history) ? config.history : [];
			const includeSubagents = config?.includeSubagents === true;
			const mode = config?.historyMode === "per-request" || config?.historyMode === "session-start" ? config.historyMode : "reapply";
			const seedMode = config?.seedMode === "hook" || config?.seedMode === "intercept" ? config.seedMode : "append";
			const secBlock = sections.length > 0 ? sections.map((s) => `          - name: ${PanelService.yamlScalar(s.name)}\n            order: ${Number(s.order) || 0}\n            text: ${PanelService.yamlScalar(s.text)}`).join("\n") : "";
			const hisBlock = history.length > 0 ? history.map((p) => `          - user: ${PanelService.yamlScalar(p.user)}\n            assistant: ${PanelService.yamlScalar(p.assistant)}`).join("\n") : "";
			return "    - id: custom-first-control-prompt\n      name: '@deepseek-ai/dsh-custom-first-control-prompt'\n      config:\n" + (sections.length > 0 ? `        sections:\n${secBlock}\n` : "        sections: []\n") + (history.length > 0 ? `        history:\n${hisBlock}\n` : "        history: []\n") + `        includeSubagents: ${includeSubagents ? "true" : "false"}\n        historyMode: ${PanelService.yamlScalar(mode)}\n        seedMode: ${PanelService.yamlScalar(seedMode)}\n`;
		}
		static buildPatch(config) {
			return "# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries (id-targeted config\n# overrides, disables, and insert lists; `!!js` expressions allowed).\n- insert:\n" + PanelService.coreBlock(config);
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
		static mergeCoreBlock(existingRaw, config) {
			const core = PanelService.coreBlock(config);
			const lines = existingRaw.split(/\r?\n/);
			const coreIdx = lines.findIndex((l) => l.trim() === "- id: custom-first-control-prompt");
			if (coreIdx === -1) {
				if (existingRaw.trim() === "") return PanelService.buildPatch(config);
				return existingRaw + (existingRaw.endsWith("\n") ? "" : "\n") + "- insert:\n" + core;
			}
			const indent = (lines[coreIdx]?.match(/^\s*/)?.[0] ?? "").length;
			let end = coreIdx + 1;
			while (end < lines.length) {
				const line = lines[end];
				if (line.trim().startsWith("- ") && (line.match(/^\s*/)?.[0] ?? "").length <= indent) break;
				end++;
			}
			return [
				...lines.slice(0, coreIdx),
				core,
				...lines.slice(end)
			].join("\n");
		}
		async readPatch() {
			const path = await this.patchPath();
			if (path === null) return {
				ok: false,
				path: "",
				raw: "",
				parsed: PanelService.parseBlock(""),
				error: "unable to locate the profile patch file (settings.prepareDocument() returned no path)"
			};
			const fs = this.ctx.get("fs");
			if (fs === void 0) return {
				ok: false,
				path,
				raw: "",
				parsed: PanelService.parseBlock(""),
				error: "fs service unavailable"
			};
			try {
				const target = await fs.resolve(path);
				const raw = await fs.readText(target);
				return {
					ok: true,
					path,
					raw,
					parsed: PanelService.parseBlock(raw),
					error: ""
				};
			} catch (error) {
				return {
					ok: false,
					path,
					raw: "",
					parsed: PanelService.parseBlock(""),
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
		async writePatch(raw) {
			const path = await this.patchPath();
			if (path === null) return {
				ok: false,
				path: "",
				error: "unable to locate the profile patch file (settings.prepareDocument() returned no path)"
			};
			const fs = this.ctx.get("fs");
			if (fs === void 0) return {
				ok: false,
				path,
				error: "fs service unavailable"
			};
			try {
				const target = await fs.resolve(path);
				await fs.writeText(target, raw, void 0, void 0, this.writePolicy());
				return {
					ok: true,
					path,
					saved: true,
					error: ""
				};
			} catch (error) {
				return {
					ok: false,
					path,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
		/** Read the profile patch entry. */
		configRead(agent) {
			return this.readPatch();
		}
		/** Write the profile patch entry regenerated from the panel's config view. */
		async configWrite(agent, config) {
			const existing = await this.readPatch();
			return this.writePatch(PanelService.mergeCoreBlock(existing.ok ? existing.raw : "", config));
		}
		/** Clear the configured prompt content, keeping the plugin installed (and any other patch lines). */
		async configClear(agent) {
			const existing = await this.readPatch();
			return this.writePatch(PanelService.mergeCoreBlock(existing.ok ? existing.raw : "", {
				found: true,
				sections: [],
				history: [],
				includeSubagents: false,
				historyMode: "reapply",
				seedMode: "append"
			}));
		}
		/** Import a raw patch file text wholesale. */
		configRawImport(agent, raw) {
			if (typeof raw !== "string" || raw.trim() === "") return Promise.resolve({
				ok: false,
				path: "",
				error: "raw content is empty; nothing written"
			});
			return this.writePatch(raw);
		}
		/** Snapshot the captured request ring plus listener state. */
		requestsList(agent) {
			return {
				requests: this.ring.slice(),
				paused: this.paused,
				dockVisible: this.dockVisible
			};
		}
		/** Pause or resume request capture. */
		requestsSetPaused(agent, paused) {
			this.paused = paused === true;
			return {
				requests: this.ring.slice(),
				paused: this.paused,
				dockVisible: this.dockVisible
			};
		}
		/** Clear the captured request ring. */
		requestsClear(agent) {
			this.ring.length = 0;
			this.seq = 0;
			return {
				requests: [],
				paused: this.paused,
				dockVisible: this.dockVisible
			};
		}
		/** Show or hide the composer dock strip. */
		uiSetDockVisible(agent, visible) {
			this.dockVisible = visible === true;
			return {
				requests: this.ring.slice(),
				paused: this.paused,
				dockVisible: this.dockVisible
			};
		}
		/** Assemble this plugin's live system-prompt sections for the preview tab. */
		async previewAssemble(agent) {
			const systemPrompt = this.ctx.get("systemPrompt");
			if (systemPrompt === void 0) return {
				sections: [],
				error: "systemPrompt service unavailable"
			};
			try {
				const assembly = await systemPrompt.assemble({});
				return { sections: (Array.isArray(assembly?.sections) ? assembly.sections : []).map((s) => ({
					name: typeof s.name === "string" ? s.name : "",
					text: typeof s.text === "string" ? s.text : "",
					order: typeof s.order === "number" ? s.order : 0
				})).filter((s) => s.name.indexOf("custom-first-control-prompt") === 0) };
			} catch (error) {
				return {
					sections: [],
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
	};
})();
//#endregion
//#region src/index.ts
/** Cordis plugin name, also the plugin attribution on the seeded message. */
const name = "custom-first-control-prompt";
/**
* Required services: the agent registry for session lifecycle events, the
* system-prompt registry for sections, plus `llm` (request redispatch) and
* `sessions` (subagent-origin filtering) for the `intercept` seed mode.
*/
const inject = [
	"agents",
	"systemPrompt",
	"llm",
	"sessions"
];
/** Cordis config schema; semantic checks beyond the schema run in {@link apply}. */
const Config = z.object({
	sections: z.array(z.object({
		name: z.string().required(),
		order: z.number().required(),
		enabled: z.boolean().default(true),
		text: z.string().required()
	})).default([]),
	history: z.array(z.object({
		user: z.string().required(),
		assistant: z.string().required()
	})),
	includeSubagents: z.boolean().default(false),
	historyMode: z.union([
		"session-start",
		"reapply",
		"per-request"
	]),
	seedMode: z.union([
		"hook",
		"append",
		"intercept"
	]),
	reapplyAfterCompaction: z.boolean()
});
/**
* Partition configured sections into mountable entries and per-entry problems.
* A blank name, a duplicate name (first wins), a non-finite order, or an empty
* text is reported and skipped: the configuration is deployment-editable, so a
* bad entry must degrade to "not injected", never fail the plugin tree and take
* the whole deployment down with it.
* @param sections - configured section entries.
* @returns the mountable entries and the human-readable problems for the rest.
*/
function partitionSections(sections) {
	const clean = [];
	const problems = [];
	const seen = /* @__PURE__ */ new Set();
	for (const [index, section] of sections.entries()) {
		if (section.name.trim() === "") {
			problems.push(`sections[${index}].name is blank`);
			continue;
		}
		if (seen.has(section.name)) {
			problems.push(`sections[${index}] reuses name "${section.name}" (first entry wins)`);
			continue;
		}
		seen.add(section.name);
		if (!Number.isFinite(section.order)) {
			problems.push(`sections[${index}].order for "${section.name}" is not a finite number`);
			continue;
		}
		if (section.text.length === 0) {
			problems.push(`sections[${index}].text for "${section.name}" is empty`);
			continue;
		}
		clean.push(section);
	}
	return {
		clean,
		problems
	};
}
/**
* Describe why one reference-history pair must be skipped, or no value when the
* pair is usable.
* @param pair - a configured reference exchange.
* @returns the problem description, or no value when the pair is usable.
*/
function pairProblem(pair) {
	for (const [field, text] of [["user", pair.user], ["assistant", pair.assistant]]) {
		if (text.length === 0) return `${field} text is empty`;
		const lower = text.toLowerCase();
		const tag = TRANSCRIPT_RESERVED_TAGS.find((reserved) => lower.includes(reserved));
		if (tag !== void 0) return `${field} text embeds reserved frame tag "${tag}"`;
	}
}
/**
* Partition configured history pairs into usable pairs and per-pair problems.
* Same degrade-instead-of-fail contract as {@link partitionSections}: an empty
* side or an embedded reserved frame tag is skipped with a warning, so a bad
* pair never fails the plugin. Skipping instead of seeding keeps the frame
* tags it would have broken out of the log.
* @param pairs - configured reference exchanges.
* @returns the usable pairs and the human-readable problems for the rest.
*/
function partitionPairs(pairs) {
	const clean = [];
	const problems = [];
	for (const [index, pair] of pairs.entries()) {
		const problem = pairProblem(pair);
		if (problem === void 0) clean.push(pair);
		else problems.push(`history[${index}] ${problem}`);
	}
	return {
		clean,
		problems
	};
}
/**
* Register configured sections and install the history application strategy
* selected by {@link Config.historyMode}.
*
* - `session-start`: one durable `agent/session-start` seed, scanning the log
*   for an earlier injection so resume and fork never duplicate it.
* - `reapply` (default): a `agent/pre-step` listener injects the framed
*   transcript only when the request's messages carry no frame from this
*   plugin — the reference history therefore stays present through compaction
*   (restored on the next request after being shadowed) at a fixed one-copy
*   cost, and configuration changes apply to the very next request.
* - `per-request`: the same listener always prepends a fresh frame, logging
*   one copy per step until compaction absorbs the earlier frames.
* @param ctx - plugin context.
* @param config - validated plugin configuration.
*/
function apply(ctx, config) {
	new PanelService(ctx);
	const { clean: mountableSections, problems: sectionProblems } = partitionSections(config.sections ?? []);
	for (const problem of sectionProblems) ctx.logger.warn("skipping a configured section: %s", problem);
	for (const section of mountableSections) {
		if (section.enabled === false) continue;
		ctx.effect(() => ctx.systemPrompt.section({
			name: `${name}:${section.name}`,
			order: section.order,
			text: section.text
		}), `${name}.section(${section.name})`);
	}
	const history = config.history;
	if (history === void 0 || history.length === 0) return;
	const { clean: pairs, problems: pairProblems } = partitionPairs(history);
	for (const problem of pairProblems) ctx.logger.warn("skipping a configured reference-history pair: %s", problem);
	if (pairs.length === 0) return;
	const seedMode = config.seedMode ?? "append";
	if (seedMode === "intercept") {
		const seedMessages = buildSeedMessages(pairs);
		const reentry = /* @__PURE__ */ new WeakSet();
		ctx.on("llm/stream", (options, next) => {
			if (reentry.has(options)) {
				reentry.delete(options);
				return next();
			}
			if (options.purpose !== void 0) return next();
			const sessionId = options.sessionId;
			if (sessionId === void 0) return next();
			if (config.includeSubagents !== true && ctx.sessions.get(sessionId)?.header.origin === "subagent") return next();
			const cloned = {
				...options,
				messages: [...seedMessages, ...options.messages]
			};
			reentry.add(cloned);
			return ctx.llm.stream(cloned);
		}, { prepend: true });
		return;
	}
	if (seedMode === "append") {
		ctx.on("agent/session-start", ({ agent }) => {
			if (config.includeSubagents !== true && agent.session.header.origin === "subagent") return;
			if (hasSeededHistory(agent.session)) return;
			appendSeedTurns(agent.session, pairs);
		});
		return;
	}
	ctx.on("agent-loop/session-seed", async (payload, next) => {
		const base = await next();
		if (base.length > 0) return base;
		if (config.includeSubagents !== true && payload.meta?.origin === "subagent") return base;
		return [...base, ...buildSeedEvents(pairs, base.length, 1)];
	});
	const mode = config.historyMode ?? (config.reapplyAfterCompaction === true ? "reapply" : config.reapplyAfterCompaction === false ? "session-start" : "reapply");
	if (mode === "session-start") {
		ctx.on("agent/session-start", ({ agent }) => {
			if (config.includeSubagents !== true && agent.session.header.origin === "subagent") return;
			if (hasSeededHistory(agent.session)) return;
			seedTranscript(agent.session, pairs);
		});
		return;
	}
	const reapply = mode === "reapply";
	const latestSeededSeq = (agent) => {
		let seq = -1;
		for (const event of agent.session.events) if (event && typeof event.seq === "number" && isSeededByPlugin(seededMessageSource(event))) {
			const eventSeq = event.seq;
			if (eventSeq > seq) seq = eventSeq;
		}
		return seq;
	};
	const latestShadowEnd = (agent) => {
		let end = -1;
		for (const event of agent.session.events) if (event && event.type === "compaction/summary") {
			const range = event.data?.shadowedRange;
			if (range && typeof range.end === "number" && range.end > end) end = range.end;
		}
		return end;
	};
	ctx.on("agent/pre-step", async ({ agent }, next) => {
		if (config.includeSubagents !== true && agent.session.header.origin === "subagent") return next();
		const decision = await next();
		if (decision.kind === "reject") return decision;
		if (reapply && latestSeededSeq(agent) > latestShadowEnd(agent)) return decision;
		return {
			kind: "enter",
			messages: [buildHistoryMessage(pairs), ...decision.messages]
		};
	}, { prepend: true });
}
/**
* No default export: the Loader's `unwrapExports` collapses a module with a
* default export onto `exports.default` (`exports.default ?? exports`), which
* would drop the named `Config` schema (and every other named export). Keep
* `name`, `inject`, `Config`, and `apply` as named exports so the full plugin
* object — schema included — survives the load path.
*/
//#endregion
export { Config, apply, inject, name };

//# sourceMappingURL=index.js.map