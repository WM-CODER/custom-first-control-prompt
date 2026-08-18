import { describe, expect, it } from 'vitest'
import { buildSeedMessages, SEED_SOURCE } from '../src/seed.ts'

const PAIRS = [
  { user: '用户测试提示词1', assistant: '助手提示词1' },
  { user: '用户测试提示词2', assistant: '助手提示词2' },
]

describe('buildSeedMessages (route C)', () => {
  it('builds one alternating user/assistant message per pair, in order', () => {
    const messages = buildSeedMessages(PAIRS)
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(messages.map(message => message.content[0])).toEqual([
      { type: 'text', text: '用户测试提示词1' },
      { type: 'text', text: '助手提示词1' },
      { type: 'text', text: '用户测试提示词2' },
      { type: 'text', text: '助手提示词2' },
    ])
  })

  it('attributes the user side to the user and the assistant side to the plugin', () => {
    const messages = buildSeedMessages(PAIRS)
    expect(messages[0]?.source).toEqual({ kind: 'user' })
    expect(messages[1]?.source).toEqual({ kind: 'plugin', plugin: SEED_SOURCE })
    expect(messages[2]?.source).toEqual({ kind: 'user' })
    expect(messages[3]?.source).toEqual({ kind: 'plugin', plugin: SEED_SOURCE })
  })

  it('carries exactly one text block per message with distinct ids', () => {
    const messages = buildSeedMessages(PAIRS)
    for (const message of messages) expect(message.content).toHaveLength(1)
    const ids = messages.map(message => message.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('deep-freezes the shared sequence so request-path consumers cannot mutate it', () => {
    const messages = buildSeedMessages(PAIRS)
    expect(Object.isFrozen(messages)).toBe(true)
    for (const message of messages) {
      expect(Object.isFrozen(message)).toBe(true)
      expect(Object.isFrozen(message.content)).toBe(true)
      expect(Object.isFrozen(message.source)).toBe(true)
    }
  })

  it('builds an empty sequence for no pairs', () => {
    expect(buildSeedMessages([])).toEqual([])
  })
})
