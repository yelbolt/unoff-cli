import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }))

import {
  ASSISTANTS,
  ASSISTANT_IDS,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  detectAssistants,
  getAssistant,
  readConfig,
  resolveConfig,
  writeConfig,
} from '../src/commands/config.js'
import {
  emitAgents,
  findLocalAgents,
  parseAgent,
  readAgentDir,
  renderAgent,
  renderAgentRoles,
} from '../src/commands/agents.js'

let tmpDir: string

const AGENT_MD = `---
name: unoff-ui
description: UI layer specialist.
layers: [ui]
model: sonnet
effort: high
maxTurns: 30
---

You are the UI specialist.
`

async function seedAgents(base = 'skills') {
  const dir = path.join(tmpDir, base, 'agents')
  await fs.ensureDir(dir)
  await fs.writeFile(path.join(dir, 'unoff-ui.md'), AGENT_MD)
  await fs.writeFile(
    path.join(dir, 'unoff-canvas-bridge.md'),
    AGENT_MD.replace('unoff-ui', 'unoff-canvas-bridge').replace(
      'layers: [ui]',
      'layers: [canvas, bridge]'
    )
  )
  await fs.writeFile(path.join(dir, 'README.md'), '# not an agent')
  return dir
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unoff-ai-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.remove(tmpDir)
})

describe('assistant registry', () => {
  it('exposes a rules file for every assistant', () => {
    for (const a of ASSISTANTS) {
      expect(a.rulesFile).toBeTruthy()
    }
  })

  it('only Claude and Copilot have an agent file format', () => {
    const withAgents = ASSISTANTS.filter((a) => a.agentsDir).map((a) => a.id)
    expect(withAgents).toEqual(['claude', 'copilot'])
  })

  it('every assistant with an agentsDir declares a filename builder', () => {
    for (const a of ASSISTANTS.filter((x) => x.agentsDir)) {
      expect(typeof a.agentFile).toBe('function')
      expect(a.agentFrontmatter?.length).toBeGreaterThan(0)
    }
  })

  it('defaults to the recommended assistants', () => {
    expect(DEFAULT_CONFIG.assistants).toEqual(
      ASSISTANTS.filter((a) => a.recommended).map((a) => a.id)
    )
  })

  it('throws on an unknown assistant id', () => {
    // @ts-expect-error deliberately invalid
    expect(() => getAssistant('notion-ai')).toThrow()
  })
})

describe('config file', () => {
  it('round-trips', async () => {
    await writeConfig(tmpDir, {
      assistants: ['claude', 'cursor'],
      specsDir: 'docs/specs',
      skillsPath: '.claude/skills/x',
    })

    const read = await readConfig(tmpDir)
    expect(read?.assistants).toEqual(['claude', 'cursor'])
    expect(read?.specsDir).toBe('docs/specs')
  })

  it('drops unknown assistant ids', async () => {
    await fs.writeJson(path.join(tmpDir, CONFIG_FILE), {
      assistants: ['claude', 'clippy'],
    })

    const read = await readConfig(tmpDir)
    expect(read?.assistants).toEqual(['claude'])
  })

  it('returns null on malformed JSON instead of throwing', async () => {
    await fs.writeFile(path.join(tmpDir, CONFIG_FILE), '{ not json')
    expect(await readConfig(tmpDir)).toBeNull()
  })

  it('falls back to defaults for missing fields', async () => {
    await fs.writeJson(path.join(tmpDir, CONFIG_FILE), {
      assistants: ['codex'],
    })

    const read = await readConfig(tmpDir)
    expect(read?.specsDir).toBe(DEFAULT_CONFIG.specsDir)
    expect(read?.skillsPath).toBe(DEFAULT_CONFIG.skillsPath)
  })
})

describe('detectAssistants()', () => {
  it('finds assistants by their rules file', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# x')
    expect(detectAssistants(tmpDir)).toContain('claude')
    expect(detectAssistants(tmpDir)).not.toContain('windsurf')
  })

  it('finds assistants by their agents directory', async () => {
    await fs.ensureDir(path.join(tmpDir, '.github', 'agents'))
    expect(detectAssistants(tmpDir)).toContain('copilot')
  })

  it('returns an empty list for a bare project', () => {
    expect(detectAssistants(tmpDir)).toEqual([])
  })
})

describe('resolveConfig()', () => {
  it('prefers the config file', async () => {
    await writeConfig(tmpDir, {
      assistants: ['codex'],
      specsDir: 'specs',
      skillsPath: 'x',
    })
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# x')

    const { config, source } = await resolveConfig(tmpDir)
    expect(source).toBe('file')
    expect(config.assistants).toEqual(['codex'])
  })

  it('falls back to detection', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# x')

    const { config, source } = await resolveConfig(tmpDir)
    expect(source).toBe('detected')
    expect(config.assistants).toEqual(['claude'])
  })

  it('falls back to defaults on a bare project', async () => {
    const { config, source } = await resolveConfig(tmpDir)
    expect(source).toBe('default')
    expect(config.assistants).toEqual(DEFAULT_CONFIG.assistants)
  })
})

describe('parseAgent() / renderAgent()', () => {
  it('splits frontmatter from body', () => {
    const agent = parseAgent(AGENT_MD, 'fallback')
    expect(agent.name).toBe('unoff-ui')
    expect(agent.frontmatter.layers).toBe('[ui]')
    expect(agent.body).toBe('You are the UI specialist.')
  })

  it('falls back to the filename when there is no frontmatter', () => {
    const agent = parseAgent('Just a body', 'my-agent')
    expect(agent.name).toBe('my-agent')
    expect(agent.body).toBe('Just a body')
  })

  it('keeps only the requested frontmatter keys', () => {
    const agent = parseAgent(AGENT_MD, 'x')
    const out = renderAgent(agent, ['name', 'description'])

    expect(out).toContain('name: unoff-ui')
    expect(out).toContain('description:')
    expect(out).not.toContain('maxTurns')
    expect(out).not.toContain('model:')
    expect(out).toContain('You are the UI specialist.')
  })

  it('skips keys the agent does not define', () => {
    const agent = parseAgent(AGENT_MD, 'x')
    expect(renderAgent(agent, ['name', 'handoffs'])).not.toContain('handoffs')
  })
})

describe('readAgentDir() / findLocalAgents()', () => {
  it('reads agents and ignores README', async () => {
    const dir = await seedAgents()
    const agents = await readAgentDir(dir)

    expect(agents).toHaveLength(2)
    expect(agents.map((a) => a.name).sort()).toEqual([
      'unoff-canvas-bridge',
      'unoff-ui',
    ])
  })

  it('returns an empty array for a missing directory', async () => {
    expect(await readAgentDir(path.join(tmpDir, 'nope'))).toEqual([])
  })

  it('finds agents next to a skills checkout', async () => {
    await seedAgents('skills')
    const agents = await findLocalAgents(tmpDir, 'skills')
    expect(agents.length).toBeGreaterThan(0)
  })

  it('returns empty when nothing local exists — no network fallback', async () => {
    expect(await findLocalAgents(tmpDir, 'nowhere')).toEqual([])
  })
})

describe('emitAgents()', () => {
  it('writes Claude agents with full frontmatter', async () => {
    const dir = await seedAgents()
    const agents = await readAgentDir(dir)

    await emitAgents(tmpDir, agents, ['claude'])

    const file = path.join(tmpDir, '.claude', 'agents', 'unoff-ui.md')
    const content = await fs.readFile(file, 'utf-8')
    expect(content).toContain('model: sonnet')
    expect(content).toContain('maxTurns: 30')
    expect(content).toContain('layers: [ui]')
  })

  it('writes Copilot agents with the .agent.md extension and trimmed frontmatter', async () => {
    const dir = await seedAgents()
    const agents = await readAgentDir(dir)

    await emitAgents(tmpDir, agents, ['copilot'])

    const file = path.join(tmpDir, '.github', 'agents', 'unoff-ui.agent.md')
    expect(fs.existsSync(file)).toBe(true)

    const content = await fs.readFile(file, 'utf-8')
    expect(content).toContain('name: unoff-ui')
    expect(content).not.toContain('maxTurns')
  })

  it('marks assistants without an agent format as degraded', async () => {
    const dir = await seedAgents()
    const agents = await readAgentDir(dir)

    const results = await emitAgents(tmpDir, agents, ['cursor', 'codex'])

    expect(results.every((r) => r.degraded)).toBe(true)
    expect(results.every((r) => r.written.length === 0)).toBe(true)
  })

  it('writes nothing outside the configured assistants', async () => {
    const dir = await seedAgents()
    const agents = await readAgentDir(dir)

    await emitAgents(tmpDir, agents, ['claude'])

    expect(fs.existsSync(path.join(tmpDir, '.github', 'agents'))).toBe(false)
  })
})

describe('renderAgentRoles()', () => {
  it('renders a table carrying the layers', async () => {
    const dir = await seedAgents()
    const agents = await readAgentDir(dir)
    const table = renderAgentRoles(agents)

    expect(table).toContain('| Role | Layers | Remit |')
    expect(table).toContain('`unoff-ui`')
    expect(table).toContain('canvas, bridge')
    expect(table).not.toContain('[ui]')
  })
})

describe('assistant ids', () => {
  it('are unique', () => {
    expect(new Set(ASSISTANT_IDS).size).toBe(ASSISTANT_IDS.length)
  })
})
