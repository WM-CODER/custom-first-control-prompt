import { a as TRANSCRIPT_RESERVED_TAGS, i as TRANSCRIPT_FRAME_OPEN, n as TRANSCRIPT_FRAME_CLOSE, r as TRANSCRIPT_FRAME_INTRO } from "./seed-C0hjxpZj.js";
//#region src/invariant.ts
const PACKAGE_NAME = "@deepseek-ai/dsh-custom-first-control-prompt";
/** Cordis plugin name of this invariant companion. */
const name = "custom-first-control-prompt-invariant";
/** Required service: the invariant registry. */
const inject = ["invariants"];
/** Escape every regexp metacharacter so fixed frame lines anchor the grammar. */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Full grammar of the transcript frame produced by `renderTranscript`. */
const TRANSCRIPT_GRAMMAR = new RegExp(`^${escapeRegExp(TRANSCRIPT_FRAME_OPEN)}\\n${escapeRegExp(TRANSCRIPT_FRAME_INTRO)}\\n(?:<exchange>\\n<user>[\\s\\S]*?</user>\\n<assistant>[\\s\\S]*?</assistant>\\n</exchange>\\n)+${escapeRegExp(TRANSCRIPT_FRAME_CLOSE)}$`);
/** Whether the event is a message seeded by this plugin (frame or conversational seed). */
function isSeededMessage(event) {
	if (event.type !== "user/message" && event.type !== "assistant/message") return false;
	const message = event.type === "user/message" ? event.data : event.data.message;
	return message.source.kind === "plugin" && message.source.plugin === "custom-first-control-prompt";
}
/** A seeded message carries exactly one text block: the documented frame, or plain conversational text. */
function validateSeededMessage(event, fail) {
	const [block, ...rest] = event.type === "user/message" ? event.data.content : event.data.message.content;
	if (rest.length > 0 || block === void 0 || block.type !== "text") fail("seeded message must carry exactly one text block");
	const framed = TRANSCRIPT_GRAMMAR.test(block.text);
	const plain = !TRANSCRIPT_RESERVED_TAGS.some((tag) => block.text.toLowerCase().includes(tag));
	if (!framed && !plain) fail("seeded message text matches neither the <custom-history> frame grammar nor plain conversational seed rules");
}
/** Replay validation of a durable log. */
function validateSession(session, fail) {
	for (const event of session.events) if (isSeededMessage(event)) validateSeededMessage(event, fail);
}
/** Install validation for loaded and newly appended seeded messages. */
const install = Object.assign((ctx, fail) => {
	for (const session of ctx.sessions.list()) validateSession(session, fail);
	ctx.on("session/created", (session) => {
		validateSession(session, fail);
	}, { global: true });
	ctx.on("internal/dispatch", (_mode, eventName, args) => {
		if (eventName !== "session/event") return;
		const [, event] = args;
		if (isSeededMessage(event)) validateSeededMessage(event, fail);
	}, { global: true });
}, { inject: ["sessions"] });
/**
* Register the custom-first-control-prompt invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };

//# sourceMappingURL=invariant.js.map