import { createRequire } from "node:module";
import z from "@deepseek-ai/schemastery";
import "@deepseek-ai/cordis";
//#region ../../llm/llm/src/brand.ts
/**
* Brand a message identifier.
* @param id - the opaque message identifier.
* @returns the same string, branded; no validation is performed.
*/
function MessageId(id) {
	return id;
}
//#endregion
//#region ../../llm/llm/src/call-config.ts
/**
* Deep-freeze a value in place with an iterative traversal, guarding cycles,
* so later mutation throws without imposing a JavaScript call-stack depth cap.
* {@link AbortSignal} objects are deliberately skipped because they are the
* request's live cancellation channel and freezing them breaks abort.
* @param value - the value to freeze in place.
* @returns the same value, frozen.
*/
function deepFreeze(value) {
	const seen = /* @__PURE__ */ new WeakSet();
	const pending = [{
		kind: "visit",
		node: value
	}];
	while (pending.length > 0) {
		const task = pending.pop();
		/* v8 ignore next -- the loop condition guarantees one pending task. */
		if (task === void 0) continue;
		if (task.kind === "property") {
			pending.push({
				kind: "visit",
				node: task.source[task.key]
			});
			continue;
		}
		const node = task.node;
		if (node === null || typeof node !== "object") continue;
		if (node instanceof AbortSignal) continue;
		if (seen.has(node)) continue;
		seen.add(node);
		Object.freeze(node);
		const keys = Object.keys(node);
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) continue;
			pending.push({
				kind: "property",
				source: node,
				key
			});
		}
	}
	return value;
}
//#endregion
//#region ../../llm/llm/src/message.ts
/** Message value types, identity, and immutable construction helpers. */
/**
* Detach and deep-freeze a message whose identity already exists.
* @param message - complete message, including its stable identity.
* @returns an immutable snapshot that preserves the identity.
*/
function freezeMessage(message) {
	return deepFreeze(structuredClone(message));
}
/**
* Create one identified message and freeze it before publication.
* @param input - complete role, content, and source for a new message.
* @returns an immutable message with a fresh stable identity.
*/
function createMessage(input) {
	return freezeMessage({
		...input,
		id: MessageId(crypto.randomUUID())
	});
}
/**
* Create one identified user-role message and freeze it before publication.
* @param input - complete content and source for a new user message.
* @returns an immutable user message with a fresh stable identity.
*/
function createUserMessage(input) {
	return createMessage({
		...input,
		role: "user"
	});
}
//#endregion
//#region ../../util/timeout/src/index.ts
/** Largest delay Node schedules without clamping it to one millisecond. */
const MAX_TIMER_DELAY_MS = 2147483647;
//#endregion
//#region ../../llm/llm/src/error.ts
/**
* Canonical provider-neutral code for a response that completed normally but
* carried no content blocks at all. Providers occasionally emit a degenerate
* completion (a terminal stop with zero output); adapters classify it as this
* failure instead of yielding an empty assistant message, because an empty
* message silently ends the turn with nothing for the user or the loop to act
* on. The attempt produced nothing durable, so retry policy treats it as safe
* to repeat.
*/
const EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
//#endregion
//#region ../../llm/llm/src/retry-policy.ts
/**
* Provider-owned request-retry policy configuration and resolution.
*
* Adapters expose one resolved policy per registered provider route; the
* optional dsh-llm-retry plugin executes it on the agent's failed-step extension point.
*
* @module @deepseek-ai/dsh-llm/retry-policy
*/
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1e4;
const DEFAULT_JITTER_RATIO = .1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
	EMPTY_RESPONSE_CODE,
	"RATE_LIMIT",
	"SERVER",
	"TIMEOUT",
	"TRANSPORT"
]);
const backoffSchema = z.object({
	initialDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
	maxDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
	jitterRatio: z.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
const normalPolicySchema = z.object({
	mode: z.const("normal").required(),
	maxRetries: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
	retryableCodes: z.array(z.string()).default([...DEFAULT_RETRYABLE_CODES]),
	backoff: backoffSchema
});
const alwaysPolicySchema = z.object({
	mode: z.const("always").required(),
	backoff: backoffSchema
});
z.union([normalPolicySchema, alwaysPolicySchema]);
//#endregion
//#region ../../llm/llm/src/attribution.ts
/**
* Centralize the non-secret product identity every provider request sends as `User-Agent`, keeping
* adapters from drifting. See
* `.agents/notes/implemented/architecture/2026-06-21-mandatory-app-attribution-headers.md`.
*
* App-attribution vocabulary for provider requests.
* @module @deepseek-ai/dsh-llm/attribution
*/
const { version } = createRequire(import.meta.url)("../package.json");
//#endregion
//#region lib/types/seed.js
/**
* Seeded-history construction for custom-first-control-prompt: the transcript
* frame renderer, the one-shot session-log append, and the durable-log scan
* that keeps resume and fork idempotent.
*/
/** Plugin attribution carried by the seeded message's `source`. */
const SEED_SOURCE = "custom-first-control-prompt";
/** Opening tag of the transcript frame, attributing the frame to this plugin. */
const TRANSCRIPT_FRAME_OPEN = `<custom-history source="${SEED_SOURCE}">`;
/** Disclaimer line inside the transcript frame, keeping fabricated exchanges honest to the model. */
const TRANSCRIPT_FRAME_INTRO = "The following exchanges are deployment-configured reference history; they did not occur in this session.";
/** Closing tag of the transcript frame. */
const TRANSCRIPT_FRAME_CLOSE = "</custom-history>";
/**
* Tags that form the transcript frame's grammar, lowercase forms. Configured
* pair texts may not contain any of them case-insensitively: an embedded tag
* would break the exchange structure the frame promises the model, so plugin
* load rejects such texts instead.
*/
const TRANSCRIPT_RESERVED_TAGS = [
	"<custom-history",
	"</custom-history>",
	"<exchange>",
	"</exchange>",
	"<user>",
	"</user>",
	"<assistant>",
	"</assistant>"
];
/**
* Render configured exchanges into the single transcript message text, wrapped
* in the documented `<custom-history>` frame.
* @param pairs - ordered reference exchanges.
* @returns the framed transcript text.
*/
function renderTranscript(pairs) {
	return [
		TRANSCRIPT_FRAME_OPEN,
		TRANSCRIPT_FRAME_INTRO,
		...pairs.map((pair) => `<exchange>\n<user>${pair.user}</user>\n<assistant>${pair.assistant}</assistant>\n</exchange>`),
		TRANSCRIPT_FRAME_CLOSE
	].join("\n");
}
/**
* The plugin attribution carried by a message event, or no value. The
* conversational seed's user side carries `{kind:'user'}` so the web chat
* renders it as an ordinary user bubble, which means the durable marker of a
* completed conversational seed is its plugin-attributed assistant side; the
* framed seed's user side is itself plugin-attributed. The two event types
* carry the source in different places: `user/message` on `data.source`, and
* `assistant/message` nested under `data.message.source`.
* @param event - a message-producing session event (other types yield no value).
* @returns the source object, or no value when the event carries none.
*/
function seededMessageSource(event) {
	if (event.type === "user/message") {
		const source = event.data.source;
		return source !== void 0 && typeof source.kind === "string" ? source : void 0;
	}
	if (event.type === "assistant/message") {
		const source = event.data.message?.source;
		return source !== void 0 && typeof source.kind === "string" ? source : void 0;
	}
}
/**
* Whether a message source attributes the message to this plugin. Both seed
* shapes mark their plugin ownership this way — the framed seed's user side
* and every conversational seed's assistant side — so the check doubles as the
* "did this session already receive the reference history" marker.
* @param source - a message source, or no value.
* @returns true when the source names this plugin.
*/
function isSeededByPlugin(source) {
	return source?.kind === "plugin" && source.plugin === "custom-first-control-prompt";
}
/**
* Whether the session log already carries this plugin's seed. Resume and fork
* both re-fire `agent/session-start` with the seed already durable, so the
* listener skips when this returns true.
* @param session - the session whose durable log is scanned.
* @returns true when a seeded message from this plugin is already logged.
*/
function hasSeededHistory(session) {
	return session.events.some((event) => isSeededByPlugin(seededMessageSource(event)));
}
/**
* Build the framed transcript as one plugin-sourced user message. Used both by
* the durable one-shot seed and by per-request pre-step injection, so every
* model-facing representation of the reference history stays byte-identical.
* @param pairs - ordered reference exchanges.
* @returns the framed, plugin-attributed user message.
*/
function buildHistoryMessage(pairs) {
	return createUserMessage({
		content: [{
			type: "text",
			text: renderTranscript(pairs)
		}],
		source: {
			kind: "plugin",
			plugin: SEED_SOURCE
		}
	});
}
/**
* Append every configured exchange as one framed plugin-sourced user message.
* `user/message` is the one message-producing event type the session invariant
* leaves unconstrained, so this seed cannot unbalance the log or disturb turn
* numbering.
* @param session - the session receiving the seed.
* @param pairs - ordered reference exchanges.
*/
function seedTranscript(session, pairs) {
	session.append("user/message", buildHistoryMessage(pairs), { surfaceOp: "append" });
}
/**
* Build balanced conversational seed events: one fully closed turn per pair,
* carrying the user and assistant sides as real messages instead of one framed
* transcript. Events are contiguously numbered from `startSeq` and turns from
* `startTurn` (a fresh session starts at seq 0, turn 1), so the factory's
* `agent/session-seed` boundary accepts them unchanged.
* @param pairs - ordered reference exchanges.
* @param startSeq - first event's sequence number (default 0).
* @param startTurn - first turn number (default 1).
* @param time - shared timestamp for every event (default `Date.now()`).
* @returns the ordered seed events.
*/
function buildSeedEvents(pairs, startSeq = 0, startTurn = 1, time = Date.now()) {
	const events = [];
	let seq = startSeq;
	pairs.forEach((pair, index) => {
		const turn = startTurn + index;
		const step = 1;
		const user = createUserMessage({
			content: [{
				type: "text",
				text: pair.user
			}],
			source: { kind: "user" }
		});
		const assistantData = {
			turn,
			step,
			message: {
				id: MessageId(`${SEED_SOURCE}-assistant-${index}`),
				role: "assistant",
				source: {
					kind: "plugin",
					plugin: SEED_SOURCE
				},
				content: [{
					type: "text",
					text: pair.assistant
				}]
			}
		};
		events.push({
			type: "turn/start",
			seq: seq++,
			time,
			data: { turn }
		}, {
			type: "step/start",
			seq: seq++,
			time,
			data: {
				turn,
				step
			}
		}, {
			type: "user/message",
			seq: seq++,
			time,
			data: user,
			surfaceOp: "append"
		}, {
			type: "assistant/message",
			seq: seq++,
			time,
			surfaceOp: "append",
			data: assistantData
		}, {
			type: "step/end",
			seq: seq++,
			time,
			data: {
				turn,
				step
			}
		}, {
			type: "turn/end",
			seq: seq++,
			time,
			data: {
				turn,
				reason: { kind: "completed" }
			}
		});
	});
	return events;
}
/**
* Append the reference exchanges as balanced conversational turns directly to a
* live session, one fully closed turn per pair. This is the "route B" seed: it
* runs at `agent/session-start` through `Session.append()` (which validates
* serializability/seq/surface but NOT the message source kind), so a deployment
* whose framework lacks the `agent-loop/session-seed` hook can still get the
* conversational tier without patching the framework. Events get their seq/time
* from the append site, and every seeded message carries the same shapes as
* {@link buildSeedEvents} (user side `kind:'user'`, assistant side plugin
* attribution with turn/step) so the renderer, the invariant companion, and the
* duplicate-seed detectors all behave identically.
* @param session - the live session receiving the seed (must be idle at turn 0).
* @param pairs - ordered reference exchanges.
*/
function appendSeedTurns(session, pairs) {
	pairs.forEach((pair, index) => {
		const turn = index + 1;
		const step = 1;
		session.append("turn/start", { turn });
		session.append("step/start", {
			turn,
			step
		});
		session.append("user/message", createUserMessage({
			content: [{
				type: "text",
				text: pair.user
			}],
			source: { kind: "user" }
		}), { surfaceOp: "append" });
		session.append("assistant/message", {
			turn,
			step,
			message: {
				id: MessageId(`${SEED_SOURCE}-assistant-${index}`),
				role: "assistant",
				source: {
					kind: "plugin",
					plugin: SEED_SOURCE
				},
				content: [{
					type: "text",
					text: pair.assistant
				}]
			}
		}, { surfaceOp: "append" });
		session.append("step/end", {
			turn,
			step
		});
		session.append("turn/end", {
			turn,
			reason: { kind: "completed" }
		});
	});
}
//#endregion
export { TRANSCRIPT_RESERVED_TAGS as a, buildSeedEvents as c, seedTranscript as d, seededMessageSource as f, TRANSCRIPT_FRAME_OPEN as i, hasSeededHistory as l, TRANSCRIPT_FRAME_CLOSE as n, appendSeedTurns as o, TRANSCRIPT_FRAME_INTRO as r, buildHistoryMessage as s, SEED_SOURCE as t, isSeededByPlugin as u };

//# sourceMappingURL=seed-d3pQqMkk.js.map