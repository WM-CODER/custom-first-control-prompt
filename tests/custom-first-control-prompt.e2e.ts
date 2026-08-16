import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type SessionEvent } from '@deepseek-ai/dsh-session'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

// Keep the Loader config under examples so both modes exercise the same deployable
// topology: local fixture source plus bare plugins owned by the examples workspace.
const driver = fileURLToPath(new URL(
  '../../../../examples/headless-agent/tests/fixtures/custom-first-control-prompt-driver.ts',
  import.meta.url,
))
const repoTsconfig = fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url))

function configPath(name: string): string {
  return fileURLToPath(new URL(
    `../../../../examples/headless-agent/tests/fixtures/custom-first-control-prompt-${name}.cordis.yml`,
    import.meta.url,
  ))
}

async function jsonlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return jsonlFiles(path)
    return entry.isFile() && entry.name.endsWith('.jsonl') ? [path] : []
  }))
  return paths.flat()
}

async function bootEvents(name: string): Promise<{ events: SessionEvent[]; stderr: string }> {
  let events: SessionEvent[] = []
  const { stderr } = await runLoaderSmoke({
    label: `custom-first-control-prompt ${name} headless smoke`,
    tempDirPrefix: `custom-first-control-prompt-${name}-e2e-`,
    binScript: driver,
    libBinScript: driver,
    configPath: configPath(name),
    tsconfigPath: repoTsconfig,
    inspect: async (cwd) => {
      const logs = await jsonlFiles(join(cwd, '.sessions'))
      expect(logs).toHaveLength(1)
      const lines = (await readFile(logs[0] as string, 'utf8')).trimEnd().split('\n')
      events = lines.slice(1).map(line => JSON.parse(line) as SessionEvent)
    },
  })
  return { events, stderr }
}

const TRANSCRIPT_TEXT = '<custom-history source="custom-first-control-prompt">\n'
  + 'The following exchanges are deployment-configured reference history; they did not occur in this session.\n'
  + '<exchange>\n<user>Seeded question one.</user>\n<assistant>Seeded answer one.</assistant>\n</exchange>\n'
  + '<exchange>\n<user>Seeded question two.</user>\n<assistant>Seeded answer two.</assistant>\n</exchange>\n'
  + '</custom-history>'

describe('custom-first-control-prompt through a real headless cordis.yml', () => {
  it('transcript mode seeds one framed message ahead of two real turns', async () => {
    const { events, stderr } = await bootEvents('transcript')
    expect(stderr).not.toContain('UNHANDLED')
    // The transcript seed consumes no turn numbers: both real turns are 1 and 2.
    expect(events.filter(event => event.type === 'turn/start').map(event => event.data.turn)).toEqual([1, 2])

    const seeded = events.filter((event): event is SessionEvent<'user/message'> =>
      event.type === 'user/message' && event.data.source.kind === 'plugin')
    expect(seeded).toHaveLength(1)
    const [seed] = seeded
    expect(seed?.data.source).toEqual({ kind: 'plugin', plugin: 'custom-first-control-prompt' })
    expect(seed?.seq).toBe(0)
    expect(seed?.surfaceOp).toBe('append')
    const text = seed?.data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
    expect(text).toBe(TRANSCRIPT_TEXT)

    const headers = events.filter(event => event.type === 'request/header')
    expect(JSON.stringify(headers)).toContain('House rule: end every reply with a period.')
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
