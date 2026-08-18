import { MessageId, createUserMessage, deepFreeze } from "@deepseek-ai/dsh-llm";
//#region src/seed.ts
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
/**
* Build the request-level seed messages for `seedMode: 'intercept'` (route C):
* one real alternating user/assistant exchange per configured pair, as plain
* `Message` objects for `GenerateOptions.messages`. Built once per plugin
* activation and shared by every intercepted request, keeping the injected
* prefix byte-identical for prefix-cache reuse. These messages never enter
* the session log — they exist only on the request path, so there is no turn
* structure to conflict with the loop's turn numbering and nothing for
* compaction to shadow. The user side carries `kind:'user'` and the assistant
* side plugin attribution, matching {@link buildSeedEvents} so every consumer
* that recognises the seed keeps recognising it.
* @param pairs - ordered reference exchanges.
* @returns the frozen alternating user/assistant message sequence.
*/
function buildSeedMessages(pairs) {
	const messages = [];
	for (const [index, pair] of pairs.entries()) {
		messages.push(createUserMessage({
			content: [{
				type: "text",
				text: pair.user
			}],
			source: { kind: "user" }
		}));
		messages.push({
			id: MessageId(`${SEED_SOURCE}-intercept-${index}`),
			role: "assistant",
			source: {
				kind: "plugin",
				plugin: SEED_SOURCE
			},
			content: [{
				type: "text",
				text: pair.assistant
			}]
		});
	}
	return deepFreeze(messages);
}
//#endregion
export { TRANSCRIPT_RESERVED_TAGS as a, buildSeedEvents as c, isSeededByPlugin as d, seedTranscript as f, TRANSCRIPT_FRAME_OPEN as i, buildSeedMessages as l, TRANSCRIPT_FRAME_CLOSE as n, appendSeedTurns as o, seededMessageSource as p, TRANSCRIPT_FRAME_INTRO as r, buildHistoryMessage as s, SEED_SOURCE as t, hasSeededHistory as u };

//# sourceMappingURL=seed-C0hjxpZj.js.map