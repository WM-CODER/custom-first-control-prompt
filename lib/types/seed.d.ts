/**
 * Seeded-history construction for custom-first-control-prompt: the transcript
 * frame renderer, the one-shot session-log append, and the durable-log scan
 * that keeps resume and fork idempotent.
 */
import { type UserMessage } from '@deepseek-ai/dsh-llm';
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
/** Plugin attribution carried by the seeded message's `source`. */
export declare const SEED_SOURCE = "custom-first-control-prompt";
/** Opening tag of the transcript frame, attributing the frame to this plugin. */
export declare const TRANSCRIPT_FRAME_OPEN = "<custom-history source=\"custom-first-control-prompt\">";
/** Disclaimer line inside the transcript frame, keeping fabricated exchanges honest to the model. */
export declare const TRANSCRIPT_FRAME_INTRO = "The following exchanges are deployment-configured reference history; they did not occur in this session.";
/** Closing tag of the transcript frame. */
export declare const TRANSCRIPT_FRAME_CLOSE = "</custom-history>";
/**
 * Tags that form the transcript frame's grammar, lowercase forms. Configured
 * pair texts may not contain any of them case-insensitively: an embedded tag
 * would break the exchange structure the frame promises the model, so plugin
 * load rejects such texts instead.
 */
export declare const TRANSCRIPT_RESERVED_TAGS: readonly string[];
/** One configured reference exchange between a user and the assistant. */
export interface HistoryPair {
    /** User-side text of the exchange. */
    user: string;
    /** Assistant-side text of the exchange. */
    assistant: string;
}
/**
 * Render configured exchanges into the single transcript message text, wrapped
 * in the documented `<custom-history>` frame.
 * @param pairs - ordered reference exchanges.
 * @returns the framed transcript text.
 */
export declare function renderTranscript(pairs: readonly HistoryPair[]): string;
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
export declare function seededMessageSource(event: SessionEvent): {
    kind: string;
    plugin?: string;
} | undefined;
/**
 * Whether a message source attributes the message to this plugin. Both seed
 * shapes mark their plugin ownership this way — the framed seed's user side
 * and every conversational seed's assistant side — so the check doubles as the
 * "did this session already receive the reference history" marker.
 * @param source - a message source, or no value.
 * @returns true when the source names this plugin.
 */
export declare function isSeededByPlugin(source: {
    kind: string;
    plugin?: string;
} | undefined): boolean;
/**
 * Whether the session log already carries this plugin's seed. Resume and fork
 * both re-fire `agent/session-start` with the seed already durable, so the
 * listener skips when this returns true.
 * @param session - the session whose durable log is scanned.
 * @returns true when a seeded message from this plugin is already logged.
 */
export declare function hasSeededHistory(session: Session): boolean;
/**
 * Build the framed transcript as one plugin-sourced user message. Used both by
 * the durable one-shot seed and by per-request pre-step injection, so every
 * model-facing representation of the reference history stays byte-identical.
 * @param pairs - ordered reference exchanges.
 * @returns the framed, plugin-attributed user message.
 */
export declare function buildHistoryMessage(pairs: readonly HistoryPair[]): UserMessage;
/**
 * Append every configured exchange as one framed plugin-sourced user message.
 * `user/message` is the one message-producing event type the session invariant
 * leaves unconstrained, so this seed cannot unbalance the log or disturb turn
 * numbering.
 * @param session - the session receiving the seed.
 * @param pairs - ordered reference exchanges.
 */
export declare function seedTranscript(session: Session, pairs: readonly HistoryPair[]): void;
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
export declare function buildSeedEvents(pairs: readonly HistoryPair[], startSeq?: number, startTurn?: number, time?: number): SessionEvent[];
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
export declare function appendSeedTurns(session: Session, pairs: readonly HistoryPair[]): void;
//# sourceMappingURL=seed.d.ts.map