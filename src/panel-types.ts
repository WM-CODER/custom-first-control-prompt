/**
 * Wire types shared by the web panel's Host service and browser half. Every
 * value crosses the Typert Remote boundary and must stay lossless-JSON.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt/panel-types
 */

/** One configured system-prompt section as the panel shows it. */
export interface PanelSectionView {
  /** Section name; the registry sees `custom-first-control-prompt:<name>`. */
  name: string
  /** Render position among all sections. */
  order: number
  /** `false` keeps the entry in configuration without registering it. */
  enabled: boolean
  /** Static section text. */
  text: string
}

/** One configured reference exchange as the panel shows it. */
export interface PanelPairView {
  /** User-side text of the exchange. */
  user: string
  /** Assistant-side text of the exchange. */
  assistant: string
}

/** Parsed view of this plugin's entry inside the profile patch file. */
export interface PanelConfigView {
  /** Whether the patch file carries this plugin's entry. */
  found: boolean
  /** Mountable sections after config degradation. */
  sections: PanelSectionView[]
  /** Usable reference pairs after config degradation. */
  history: PanelPairView[]
  /** Whether subagent-originated sessions are opted in. */
  includeSubagents: boolean
  /** Reference-history application mode. */
  historyMode: string
  /** Conversational-seed mechanism: 'hook' (route A) | 'append' (route B, default) | 'intercept' (route C). */
  seedMode: string
}

/** Result of reading the profile patch entry. */
export interface PanelConfigReadResult {
  /** Whether the patch file was read successfully. */
  ok: boolean
  /** Absolute path of the profile patch file. */
  path: string
  /** Raw file text; empty when the read failed. */
  raw: string
  /** Parsed entry view; `found` is false when the file lacks the entry. */
  parsed: PanelConfigView
  /** Human-readable failure reason; empty on success. */
  error: string
}

/** Result of writing the profile patch file. */
export interface PanelWriteResult {
  /** Whether the file was written. */
  ok: boolean
  /** Absolute path of the profile patch file. */
  path: string
  /** Present when the write succeeded. */
  saved?: boolean
  /** Human-readable failure reason; empty on success. */
  error: string
}

/** One captured model request, reduced to plaintext leaf fields. */
export interface PanelRequestView {
  /** Capture ordinal, reset by the clear operation. */
  id: number
  /** Capture timestamp (epoch milliseconds). */
  time: number
  /** Model id, when the request carried one. */
  model: string
  /** Provider route, when the request carried one. */
  provider: string
  /** System prompt text, when the request carried one. */
  system: string
  /**
   * Call purpose when the request carried one (e.g. `session-title`,
   * `compaction`); empty for ordinary conversation requests. Conversation
   * requests are the ones seed injection (route C) applies to.
   */
  purpose: string
  /** Plaintext message list. */
  messages: { role: string; text: string }[]
}

/** Ring snapshot plus the listener state the panel owns. */
export interface PanelRequestsView {
  /** Captured requests, oldest first. */
  requests: PanelRequestView[]
  /** Whether capture is paused (default true). */
  paused: boolean
  /** Whether the composer dock strip is visible. */
  dockVisible: boolean
}

/** One assembled section contributed by this plugin. */
export interface PanelAssembledSection {
  /** Full registry name (`custom-first-control-prompt:<name>`). */
  name: string
  /** Rendered section text. */
  text: string
  /** Render position. */
  order: number
}

/** Result of assembling this plugin's live system-prompt sections. */
export interface PanelAssembleResult {
  /** Sections contributed by this plugin in the current assembly. */
  sections: PanelAssembledSection[]
  /** Human-readable failure reason; empty on success. */
  error?: string
}
