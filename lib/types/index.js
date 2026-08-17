import z from '@deepseek-ai/schemastery';
import { appendSeedTurns, buildHistoryMessage, buildSeedEvents, hasSeededHistory, isSeededByPlugin, seededMessageSource, seedTranscript, TRANSCRIPT_RESERVED_TAGS } from "./seed.js";
import { PanelService } from "./panel.js";
/** Cordis plugin name, also the plugin attribution on the seeded message. */
export const name = 'custom-first-control-prompt';
/** Required services: the agent registry for session lifecycle events and the system-prompt registry for sections. */
export const inject = ['agents', 'systemPrompt'];
/** Cordis config schema; semantic checks beyond the schema run in {@link apply}. */
export const Config = z.object({
    sections: z.array(z.object({
        name: z.string().required(),
        order: z.number().required(),
        enabled: z.boolean().default(true),
        text: z.string().required(),
    })).default([]),
    history: z.array(z.object({
        user: z.string().required(),
        assistant: z.string().required(),
    })),
    includeSubagents: z.boolean().default(false),
    historyMode: z.union(['session-start', 'reapply', 'per-request']),
    seedMode: z.union(['hook', 'append']),
    reapplyAfterCompaction: z.boolean(),
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
    const seen = new Set();
    for (const [index, section] of sections.entries()) {
        if (section.name.trim() === '') {
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
    return { clean, problems };
}
/**
 * Describe why one reference-history pair must be skipped, or no value when the
 * pair is usable.
 * @param pair - a configured reference exchange.
 * @returns the problem description, or no value when the pair is usable.
 */
function pairProblem(pair) {
    for (const [field, text] of [['user', pair.user], ['assistant', pair.assistant]]) {
        if (text.length === 0) {
            return `${field} text is empty`;
        }
        const lower = text.toLowerCase();
        const tag = TRANSCRIPT_RESERVED_TAGS.find(reserved => lower.includes(reserved));
        if (tag !== undefined) {
            return `${field} text embeds reserved frame tag "${tag}"`;
        }
    }
    return undefined;
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
        if (problem === undefined) {
            clean.push(pair);
        }
        else {
            problems.push(`history[${index}] ${problem}`);
        }
    }
    return { clean, problems };
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
export function apply(ctx, config) {
    // The web panel service stays available even with no configured content:
    // it manages the patch entry and captures requests for the browser half.
    new PanelService(ctx);
    const sections = config.sections ?? [];
    const { clean: mountableSections, problems: sectionProblems } = partitionSections(sections);
    for (const problem of sectionProblems)
        ctx.logger.warn('skipping a configured section: %s', problem);
    for (const section of mountableSections) {
        if (section.enabled === false)
            continue;
        ctx.effect(() => ctx.systemPrompt.section({
            name: `${name}:${section.name}`,
            order: section.order,
            text: section.text,
        }), `${name}.section(${section.name})`);
    }
    const history = config.history;
    if (history === undefined || history.length === 0)
        return;
    const { clean: pairs, problems: pairProblems } = partitionPairs(history);
    for (const problem of pairProblems)
        ctx.logger.warn('skipping a configured reference-history pair: %s', problem);
    if (pairs.length === 0)
        return;
    // Route B (seedMode 'append'): session-start-only conversational injection
    // through Session.append() — no framework hook, no pre-step frames, and
    // historyMode is deliberately ignored (one-shot at session start by design).
    // Fully isolated from route A: this branch returns before any hook listener
    // or pre-step listener is registered, so a deployment toggling the switch
    // never double-injects, and reverting to the default ('hook') on restart
    // restores the exact route-A behavior.
    // Route B (append) is the default mechanism: Session.append() needs no
    // framework hook or patch, so the conversational tier works on npm 0.1.x out
    // of the box; an explicit 'hook' opts back into the framework seed boundary.
    const seedMode = config.seedMode ?? 'append';
    if (seedMode === 'append') {
        ctx.on('agent/session-start', ({ agent }) => {
            if (config.includeSubagents !== true && agent.session.header.origin === 'subagent')
                return;
            if (hasSeededHistory(agent.session))
                return;
            appendSeedTurns(agent.session, pairs);
        });
        return;
    }
    // Plan A conversational seed: contribute one balanced turn per pair at
    // session creation, so the model sees real user/assistant exchanges instead
    // of one framed transcript. Skipped when the accumulated seed is non-empty
    // (a fork already carries the reference history) and for subagent-originated
    // sessions unless the deployment opted them in.
    ctx.on('agent-loop/session-seed', async (payload, next) => {
        const base = await next();
        if (base.length > 0)
            return base;
        if (config.includeSubagents !== true && payload.meta?.origin === 'subagent')
            return base;
        return [...base, ...buildSeedEvents(pairs, base.length, 1)];
    });
    const mode = config.historyMode ?? (config.reapplyAfterCompaction === true ? 'reapply'
        : config.reapplyAfterCompaction === false ? 'session-start'
            : 'reapply');
    if (mode === 'session-start') {
        ctx.on('agent/session-start', ({ agent }) => {
            if (config.includeSubagents !== true && agent.session.header.origin === 'subagent')
                return;
            if (hasSeededHistory(agent.session))
                return;
            seedTranscript(agent.session, pairs);
        });
        return;
    }
    const reapply = mode === 'reapply';
    // Seq of the newest frame this plugin has durably logged for the agent, and
    // the shadow boundary of the latest compaction. A frame whose seq lies past
    // the boundary still reaches derived history; one at/below it was shadowed.
    // The marker covers both seed shapes: the conversational seed's user side is
    // a plain user message, so its plugin-attributed assistant side stands in
    // for it (same contiguous event range, same seq semantics).
    const latestSeededSeq = (agent) => {
        let seq = -1;
        for (const event of agent.session.events) {
            if (event && typeof event.seq === 'number'
                && isSeededByPlugin(seededMessageSource(event))) {
                const eventSeq = event.seq;
                if (eventSeq > seq)
                    seq = eventSeq;
            }
        }
        return seq;
    };
    const latestShadowEnd = (agent) => {
        let end = -1;
        for (const event of agent.session.events) {
            if (event && event.type === 'compaction/summary') {
                const range = event.data?.shadowedRange;
                if (range && typeof range.end === 'number' && range.end > end)
                    end = range.end;
            }
        }
        return end;
    };
    ctx.on('agent/pre-step', async ({ agent }, next) => {
        if (config.includeSubagents !== true && agent.session.header.origin === 'subagent')
            return next();
        const decision = await next();
        if (decision.kind === 'reject')
            return decision;
        if (reapply && latestSeededSeq(agent) > latestShadowEnd(agent)) {
            // An unshadowed frame already reaches derived history; keep it at one copy.
            return decision;
        }
        return {
            kind: 'enter',
            messages: [buildHistoryMessage(pairs), ...decision.messages],
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
//# sourceMappingURL=index.js.map