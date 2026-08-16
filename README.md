# @deepseek-ai/dsh-custom-first-control-prompt

English | [中文](README.zh.md)

Deployment-configured prompt prefix. Ordered system-prompt sections render ahead of the deployment persona, and configured reference user/assistant exchanges are seeded into the session log once, before the first turn. Static content renders byte-identically on every request, preserving prefix-cache reuse.

> Troubleshooting and test methods for the deployment (web fail-loud causes, duplicate-id inserts, seeded-message turn/step, API verification chain — all paths sanitized) live in [DEBUG-NOTES.zh.md](DEBUG-NOTES.zh.md). One-command install: [INSTALL.md](INSTALL.md). Cross-machine verified walkthrough (npm deployments, framework patch for the conversational tier): [INSTALL-FULL.zh.md](INSTALL-FULL.zh.md); plan analysis: [PLAN-A-REVISED.md](PLAN-A-REVISED.md).

> **Note**: `panel/` is the legacy in-process dynamic-panel source from the cordis_define era and is **deprecated** — the shipped panel is the formal client bundle in `client-ui/`.

## Config

```yaml
- id: custom-first-control-prompt
  name: '@deepseek-ai/dsh-custom-first-control-prompt'
  config:
    sections:
      - name: house-rules
        order: -50
        text: |
          …stable system text…
    history:
      - user: …
        assistant: …
    includeSubagents: false
```

| Key | Default | Meaning |
|---|---|---|
| `sections` | — | Ordered system-prompt fragments. Absent or empty registers nothing. |
| `sections[].name` | required | Entry name; the registry sees `custom-first-control-prompt:<name>`. |
| `sections[].order` | required | Render position among all sections. The shipped bands place the harness identity at −100, the persona at 0, and tool guidance at 100–199; values below 0 prepend ahead of the persona. |
| `sections[].enabled` | `true` | `false` keeps the entry in configuration without registering it. |
| `sections[].text` | required | Static section text. Keep it free of volatile values such as timestamps: any change invalidates prefix reuse from the first changed token. |
| `history` | — | Ordered `user`/`assistant` reference exchanges seeded before the first turn; both texts must be non-empty and must not embed a reserved frame tag case-insensitively (`<user>`, `<assistant>`, `<exchange>`, `<custom-history`, or any closing tag), since an embedded tag would break the exchange structure the frame promises the model. Absent or empty seeds nothing. |
| `includeSubagents` | `false` | `false` skips sessions whose header meta marks subagent origin. |
| `historyMode` | `reapply` | Reference-history application mode; see Seeded History below. |
| `seedMode` | `hook` | Conversational-seed mechanism: `hook` (route A, framework `agent-loop/session-seed` seed boundary; requires a hook-capable mainline build) or `append` (route B, `agent/session-start` + `Session.append()`; **no framework hook/patch needed, works on npm 0.1.x**). See "Conversational seed mechanism (route B)". |
| `reapplyAfterCompaction` | — | Legacy alias: `true` maps to `historyMode: 'reapply'`, `false` maps to `'session-start'`; an explicit `historyMode` wins. |

Misconfiguration fails plugin load with the offending entry named: unpaired roles, empty text, duplicate section names, or a non-finite order.

## System sections

Each enabled entry registers through `ctx.systemPrompt.section()` at plugin load, so the section participates in every assembly exactly like shipped sections: variable interpolation, scoped shadowing, and the assembly waterfall all apply. Static configured text renders identically on every assembly, which is what keeps the request prefix reusable.

## Seeded history

At session creation the plugin contributes one balanced, fully closed turn per configured pair through the `agent-loop/session-seed` waterfall, so the model sees the reference history as **real alternating user/assistant messages**, not one framed transcript. `historyMode` then picks the **post-compaction fallback**:

| Mode | Creation seed | Post-compaction fallback | Token | Compaction-immune |
|---|---|---|---|---|
| `session-start` | conversational turns | none | fixed 1 copy | no (seed may be shadowed) |
| `reapply` (default) | conversational turns | re-inject the framed transcript when the newest seeded frame is at/below the latest shadow boundary | fixed 1 copy | yes (restored on the next request after being shadowed) |
| `per-request` | conversational turns | prepend a fresh frame to every request (logged with the step) | accumulates per turn until compaction | yes (most aggressive) |

`reapply` is the recommended default: the seeded conversational turns stay in derived history until compaction shadows them; afterwards the next request injects one fresh framed transcript (a single user message) and keeps it at one copy. The frame fallback is the original transcript format, so post-compaction requests remain readable while the pre-compaction requests show true dialogue roles. In `session-start` mode the listener scans the log for an earlier injection so resume and fork never duplicate it.

## Model Experience

### Deployment system sections

#### What the model sees

The configured section texts at their configured order positions — ahead of the persona by default — rendered by [dsh-system-prompt](../../core/system-prompt/README.md) together with the shipped sections.

#### Token effect

Each section repeats on every request and scales with its rendered length.

#### KV Cache effect

Prefix-stable while section text, order, and the enabled set render identically. Any change may invalidate reuse from the first changed system-prompt token.

### Seeded exchange history

#### What the model sees

Real alternating messages ahead of the first real prompt — one user message per configured `user` text and one assistant message per configured `assistant` text:

```markdown
[user]      configured user text 1
[assistant] configured assistant text 1
[user]      configured user text 2
[assistant] configured assistant text 2
```

After compaction shadows the seeded turns, `reapply` and `per-request` fall back to the framed transcript format (one user message):

```markdown
<custom-history source="custom-first-control-prompt">
The following exchanges are deployment-configured reference history; they did not occur in this session.
<exchange>
<user>configured user text</user>
<assistant>configured assistant text</assistant>
</exchange>
</custom-history>
```

#### Token effect

`reapply` and `session-start` cost a fixed one copy of the reference dialogue per request; `per-request` logs an additional frame per turn, so requests within a compression interval carry multiple copies until compaction absorbs the earlier frames.

#### KV Cache effect

All three modes keep the reference dialogue first in the message sequence and byte-stable, so the request prefix stays reusable; `reapply` and `per-request` are immune to compaction, while `session-start` reuse lasts until compaction.

## Known Limitations and Deferred Work

- **No mid-session mutation** — `reapply` and `per-request` apply configuration changes to the next request immediately; `session-start` applies them to new sessions only. A compliant idle-time edit would append surface-replacement events with cited source seqs and is deferred.
- **Compaction may shadow the durable seed** — only with `historyMode: 'session-start'`: the seeded conversational turns are ordinary surface content; after compaction they can leave derived history while the system sections remain. `reapply` and `per-request` are immune and fall back to the framed transcript.
- **`per-request` accumulates logged frames between compactions** — after the seed is shadowed, every request appends one framed `user/message`; earlier frames are absorbed by compaction, but within a compression interval requests carry multiple copies of the reference dialogue (token cost grows linearly with turns until compaction). For a fixed cost use `reapply` (the default).
- **Seeded turns occupy turn numbers** — the conversational seed consumes turns 1..N, so the first real turn starts at N+1 in session-log numbering. Surface features that display turn numbers see the offset.
- **Seeded text is model-visible reference material** — the frame disclaims that the exchanges did not occur, but a deployment should treat the content as prompt text the model reads, not as a trusted channel.
