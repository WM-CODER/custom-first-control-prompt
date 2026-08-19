/**
 * Seed-message construction for custom-first-control-prompt: the request-path
 * alternating user/assistant sequence built once per plugin activation and
 * shared by every intercepted request.
 */
import { createUserMessage, deepFreeze, MessageId, type Message } from '@deepseek-ai/dsh-llm'

/** Plugin attribution carried by the injected assistant messages' `source`. */
export const SEED_SOURCE = 'custom-first-control-prompt'

/**
 * Exchange tags the injected texts may not contain case-insensitively. The
 * reference exchanges travel as plain message texts; embedding the tag
 * grammar would invite the model to re-parse (or forge) exchange markup that
 * no longer exists, so plugin load skips such texts with a warning instead.
 */
export const TRANSCRIPT_RESERVED_TAGS: readonly string[] = [
  '<custom-history',
  '</custom-history>',
  '<exchange>',
  '</exchange>',
  '<user>',
  '</user>',
  '<assistant>',
  '</assistant>',
]

/** One configured reference exchange between a user and the assistant. */
export interface HistoryPair {
  /** User-side text of the exchange. */
  user: string
  /** Assistant-side text of the exchange. */
  assistant: string
}

/**
 * Build the request-level seed messages: one real alternating user/assistant
 * exchange per configured pair, as plain `Message` objects for
 * `GenerateOptions.messages`. Built once per plugin activation and shared by
 * every intercepted request, keeping the injected prefix byte-identical for
 * prefix-cache reuse. These messages never enter the session log — they exist
 * only on the request path, so there is no turn structure to conflict with
 * the loop's turn numbering and nothing for compaction to shadow. The user
 * side carries `kind:'user'` and the assistant side plugin attribution.
 * @param pairs - ordered reference exchanges.
 * @returns the frozen alternating user/assistant message sequence.
 */
export function buildSeedMessages(pairs: readonly HistoryPair[]): readonly Message[] {
  const messages: Message[] = []
  for (const [index, pair] of pairs.entries()) {
    messages.push(createUserMessage({
      content: [{ type: 'text', text: pair.user }],
      source: { kind: 'user' },
    }))
    messages.push({
      id: MessageId(`${SEED_SOURCE}-intercept-${index}`),
      role: 'assistant',
      source: { kind: 'plugin', plugin: SEED_SOURCE },
      content: [{ type: 'text', text: pair.assistant }],
    })
  }
  return deepFreeze(messages)
}
