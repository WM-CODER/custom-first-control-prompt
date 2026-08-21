# @wm-coders/dsh-custom-first-control-prompt

English | [中文](README.zh.md)

Deployment-configured prompt prefix. Ordered system-prompt sections render ahead of the deployment persona, and configured reference user/assistant exchanges are injected into **every ordinary conversation request** — as real alternating messages prepended on the request path (`llm/stream` interception, zero session-log writes). Static content renders byte-identically on every request, preserving prefix-cache reuse.

## Installation

```bash
# From GitHub (recommended — built artifacts committed, no build approval needed)
dsh plugin --profile web add github:WM-CODER/custom-first-control-prompt

# From npm
dsh plugin --profile web add @wm-coders/dsh-custom-first-control-prompt

# From local directory (development)
dsh plugin --profile web add ./path/to/custom-first-control-prompt
```

After installation, restart the web app (`dsh --profile web` or run `restart-web.ps1` / `restart-web.sh`).

To uninstall:

```bash
dsh plugin --profile web remove @wm-coders/dsh-custom-first-control-prompt
```

> Install / deployment / debugging obstacles and test methods: [DEBUG-NOTES.zh.md](DEBUG-NOTES.zh.md) (in Chinese; web fail-loud root causes, duplicate-id inserts, API verification chains — all paths scrubbed). One-command install: [INSTALL.md](INSTALL.md). Full cross-machine walkthrough: [INSTALL-FULL.zh.md](INSTALL-FULL.zh.md) (Chinese).

## Configuration

```yaml
- id: custom-first-control-prompt
  name: '@wm-coders/dsh-custom-first-control-prompt'
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
| `sections` | — | Ordered system-prompt fragments; absent or empty registers nothing. |
| `sections[].name` | required | Entry name; the registry sees `custom-first-control-prompt:<name>`. |
| `sections[].order` | required | Render position among all sections. Factory convention: harness identity −100, persona 0, tool guidance 100–199; values below 0 prepend ahead of the persona. |
| `sections[].enabled` | `true` | `false` keeps the entry in configuration without registering it. |
| `sections[].text` | required | Static section text; keep it free of volatile values — any change breaks prefix reuse from the first changed token. |
| `history` | — | Ordered `user`/`assistant` reference exchanges injected ahead of every ordinary conversation request; both texts must be non-empty and free of reserved tags (case-insensitive: `<user>`, `<assistant>`, `<exchange>`, `<custom-history` and all closing tags). Absent or empty injects nothing. |
| `includeSubagents` | `false` | `false` skips sessions whose header meta marks subagent origin. |

Invalid configuration fails plugin load naming the offending entry: empty text, duplicate section names, or a non-finite order. Per-entry section problems (blank/duplicate name, bad order, empty text) and per-pair history problems (empty text, embedded reserved tags) **degrade to skipping that entry with a warning** instead of failing the plugin tree.

## Injection mechanism

The reference exchanges are built once at plugin activation into alternating real `Message` objects (deep-frozen, shared by reference across requests), then prepended onto every ordinary conversation request by an `llm/stream` waterfall listener:

- **Clone and redispatch**: loop-built requests are deep-frozen and marker-tagged (`markAgentLoopRequest(deepFreeze(...))`) and never mutated; the listener clones the request, prepends the seed messages, and redispatches through `ctx.llm.stream`. The clone carries no loop marker, the agent-loop log-reconstruction invariant does not apply to it, and the discarded original is a pure `deriveMessages()` projection.
- **Zero log writes**: seed messages live only on the request path — real turn numbering starts at 1 with no collisions, forks are ordinary copies, and compaction cannot shadow the reference history (every request re-injects it).
- **Scope filtering**: auxiliary calls (`purpose`-stamped, e.g. session-title, compaction) and hand-built requests (no `sessionId`) pass straight through; subagent-origin sessions are skipped by default (`includeSubagents: true` opts in).
- **Panel verification**: not seeing the seed messages in the chat transcript is expected; use the panel's LLM listener to inspect the injected real request (Settings → "Custom first control prompt" → LLM listening, or the dock strip above the composer).

**Verifying the injection works**: in a fresh session ask a question only the injected history can answer (e.g. "repeat our earliest user message") — the model quoting the configured content proves it. `session.history` shows no seed messages (a clean log is a feature, not a failure).

**Panel save semantics**: the panel's config editor writes an **id-targeted override** into the profile `cordis.patch.yml` (never an insert, so it cannot collide with the bundle layer's row), updating only this plugin's core row (`custom-first-control-prompt`) and **preserving everything else** — other entries, comments, and legacy rows. While the profile patch carries no row, the editor shows the composed config (bundle-layer defaults); saving then creates the override.

## System sections

Each enabled entry registers via `ctx.systemPrompt.section()` at plugin load, so it participates in every assembly exactly like the factory sections: variable interpolation, scope shadowing, and the assembly waterfall all apply. Static configured text renders identically in every assembly, which is what keeps the request prefix reusable.

## Model experience

### Deployment system sections

#### What the model sees

Configured section text renders at its configured order position — by default ahead of the persona — alongside the factory sections from [dsh-system-prompt](https://github.com/deepseek-ai/deepseek-harness).

#### Token impact

Every section repeats on every request; cost scales with rendered length.

#### KV-cache impact

Prefixes stay stable while section text, order, and the enabled set render identically. Any change can break reuse from the first changed system-prompt token.

### Reference conversation history

#### What the model sees

Real alternating messages at the head of every ordinary conversation request — one user message per configured `user` text, one assistant message per configured `assistant` text:

```markdown
[user]      configured user text 1
[assistant] configured assistant text 1
[user]      configured user text 2
[assistant] configured assistant text 2
[user]      the real prompt…
```

#### Token impact

A fixed single copy of the reference history per request (it never accumulates across turns, and compaction changes nothing — every request re-prepends the same frozen message sequence).

#### KV-cache impact

The reference history leads the message sequence byte-stably, keeping request prefixes reusable.

## Known limitations and deferred work

- **The chat UI never shows the reference history** — the seeds live only on the request path; neither alternating messages nor framework rows appear in the conversation UI. Reconstructing model-visible content requires the session log **plus** the deployment config (the framework exposes no plugin event-type registry and `Session.append` cannot carry an `ignorable` envelope) — a deliberate, declared deviation from the harness log-reconstruction default.
- **Seed text is model-visible reference material** — treat it as prompt text the model reads, not a trusted channel.
- **No mid-session edits** — configuration changes take effect for new requests after a web restart; a compliant "edit while quiescent" surface-replacement event carrying a source seq reference is deferred.

## FAQ: how does the plugin enter the composition?

The package declares `dsh.bundle` (in-package `cordis.patch.yml`), and the
reconciliation inside `dsh plugin add` activates that bundle layer — **the
core row `custom-first-control-prompt` (server logic: system sections,
reference-history injection) appears with no hand-written patch rows**. The
browser panel (settings page, dock, LLM listener) is auto-discovered via the
package's `dsh.client` declaration — no separate patch row for the UI half.
`dsh plugin remove` drops the dependency and the bundle layer together.

- **Customizing**: never copy a `- insert:` row. Write an **id-targeted
  (non-insert) patch** in the profile `cordis.patch.yml` to override the bundle
  row's config (last write wins) — sample in `cordis.patch.yml.template`; the
  panel's config editor saves exactly this form.
- **Offline junction installs** skip reconciliation, so the bundle layer never
  activates — `install.ps1 -Offline` writes the same two rows into the profile
  patch instead.
- **Duplicate-id warning**: once the bundle layer carries the rows, any leftover
  `- insert:` row with the same id in the profile patch (from a manual-era
  install) = **root-list duplicate → the web fails to boot**; `uninstall.ps1`
  strips both shapes surgically.
