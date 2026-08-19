import { describe, expect, it } from 'vitest'
import { PanelService } from '../src/panel.ts'
import type { PanelConfigView } from '../src/panel-types.ts'

/**
 * mergeCoreBlock is a private static on PanelService. The composition-safety
 * contract it enforces — a profile-layer write must never emit a duplicate
 * `- insert:` for the core row once the bundle layer carries it — is asserted
 * through the runtime-accessible static; no public surface reaches it without
 * a full fs/settings service stack.
 */
const mergeCoreBlock = (PanelService as unknown as {
  mergeCoreBlock(existingRaw: string, config: PanelConfigView | undefined): string
}).mergeCoreBlock

const CONFIG: PanelConfigView = {
  found: true,
  sections: [{ name: 'system', order: -50, text: 'S1', enabled: true }],
  history: [{ user: 'U1', assistant: 'A1' }],
  includeSubagents: false,
}

describe('panel patch merge (composition safety)', () => {
  it('appends a targeted override, never an insert, when the profile patch lacks the row', () => {
    const existing = '# user comment\n- id: some-other-plugin\n  config: {}\n'
    const out = mergeCoreBlock(existing, CONFIG)
    expect(out).not.toContain('- insert:')
    expect(out).toContain('- id: custom-first-control-prompt\n  config:')
    expect(out).toContain('- id: some-other-plugin')
    expect(out).toContain('# user comment')
    expect(out).toContain('text: "S1"')
    expect(out).toContain('user: "U1"')
    expect(out).toContain('assistant: "A1"')
    expect(out).toContain('includeSubagents: false')
  })

  it('an empty file yields the header plus a targeted override', () => {
    const out = mergeCoreBlock('', CONFIG)
    expect(out).not.toContain('- insert:')
    expect(out).toContain('- id: custom-first-control-prompt\n  config:')
    expect(out).toContain('top-level YAML array')
  })

  it('rebuilds a comment-only file with a bare [] instead of appending after it', () => {
    // `[]` is a complete YAML document; an override appended after it makes
    // the file unparseable and fails the whole web boot (observed live).
    const existing = '# header line\n# second comment\n[]\n'
    const out = mergeCoreBlock(existing, CONFIG)
    expect(out).toContain('# header line')
    expect(out).toContain('# second comment')
    expect(out).not.toContain('[]')
    expect(out).toContain('- id: custom-first-control-prompt\n  config:')
    expect(out).not.toContain('- insert:')
  })

  it('the appended override carries no package name (the bundle row owns resolution)', () => {
    const out = mergeCoreBlock('', CONFIG)
    expect(out).not.toContain('dsh-custom-first-control-prompt')
  })

  it('replaces a legacy insert row in place, preserving siblings and comments', () => {
    const existing = '# header\n'
      + '- insert:\n'
      + '    - id: custom-first-control-prompt\n'
      + "      name: '@deepseek-ai/dsh-custom-first-control-prompt'\n"
      + '      config:\n'
      + '        sections: []\n'
      + '        history: []\n'
      + '        includeSubagents: false\n'
      + '\n'
      + '    - id: ui-custom-first-control-prompt\n'
      + "      name: '@deepseek-ai/dsh-client-ui-custom-first-control-prompt'\n"
    const out = mergeCoreBlock(existing, CONFIG)
    expect(out).toContain('# header')
    expect(out).toContain('- id: ui-custom-first-control-prompt')
    expect(out).toContain("name: '@deepseek-ai/dsh-custom-first-control-prompt'")
    expect(out).toContain('text: "S1"')
    expect(out.match(/- id: custom-first-control-prompt/g)).toHaveLength(1)
  })

  it('clearing writes an explicit empty override', () => {
    const out = mergeCoreBlock('', { found: true, sections: [], history: [], includeSubagents: false })
    expect(out).toContain('sections: []')
    expect(out).toContain('history: []')
    expect(out).not.toContain('- insert:')
  })
})
