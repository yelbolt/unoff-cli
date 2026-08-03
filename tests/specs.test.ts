import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

// Mock inquirer before importing the commands
vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}))

import inquirer from 'inquirer'
import { addSpecs } from '../src/commands/add.js'
import {
  syncSpecs,
  readSpecs,
  parseFrontmatter,
  skillsForLayers,
  injectBlock,
  renderPointerBlock,
  BLOCK_START,
  BLOCK_END,
  INDEX_FILE,
  LAYERS,
} from '../src/commands/specs.js'
import { removeSpecs } from '../src/commands/remove.js'

const mockPrompt = vi.mocked(
  inquirer.prompt as (...args: unknown[]) => Promise<unknown>
)

// Sentinel error to distinguish process.exit calls from real errors
class ProcessExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`)
  }
}

let tmpDir: string

const SPEC = (name: string, layers: string, platforms = 'figma, penpot') =>
  `---
name: ${name}
description: Spec for ${name}.
layers: [${layers}]
platforms: [${platforms}]
status: draft
---

# ${name}
`

async function seedSpecs(files: Record<string, string>) {
  const specsPath = path.join(tmpDir, 'specs')
  await fs.ensureDir(specsPath)
  for (const [file, content] of Object.entries(files)) {
    await fs.writeFile(path.join(specsPath, file), content)
  }
  return specsPath
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unoff-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  vi.spyOn(process, 'exit').mockImplementation((code?: any) => {
    throw new ProcessExitError(code ?? 0)
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.remove(tmpDir)
})

describe('addSpecs()', () => {
  it('creates the spec file with routing frontmatter and content', async () => {
    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ specName: 'my-feature' })
      .mockResolvedValueOnce({ layers: ['ui', 'config'] })
      .mockResolvedValueOnce({ platforms: ['figma'] })

    await addSpecs()

    const filePath = path.join(tmpDir, 'specs', 'my-feature.md')
    expect(fs.existsSync(filePath)).toBe(true)

    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('name: my-feature')
    expect(content).toContain('description:')
    expect(content).toContain('layers: [ui, config]')
    expect(content).toContain('platforms: [figma]')
    expect(content).toContain('# My Feature')
    expect(content).toContain('## Acceptance criteria')
    expect(content).toContain('## Out of scope')
  })

  it('creates nested folder if it does not exist', async () => {
    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'deep/nested/specs' })
      .mockResolvedValueOnce({ specName: 'test-spec' })
      .mockResolvedValueOnce({ layers: ['ui'] })
      .mockResolvedValueOnce({ platforms: ['figma', 'penpot'] })

    await addSpecs()

    expect(
      fs.existsSync(
        path.join(tmpDir, 'deep', 'nested', 'specs', 'test-spec.md')
      )
    ).toBe(true)
  })

  it('calls process.exit(1) if spec file already exists', async () => {
    await seedSpecs({ 'existing.md': '# existing' })

    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ specName: 'existing' })

    await expect(addSpecs()).rejects.toThrow(ProcessExitError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('parseFrontmatter()', () => {
  it('reads flat keys and list values', () => {
    const fm = parseFrontmatter(SPEC('paywall', 'ui, config'))
    expect(fm.name).toBe('paywall')
    expect(fm.layers).toBe('[ui, config]')
    expect(fm.status).toBe('draft')
  })

  it('returns an empty object when there is no frontmatter', () => {
    expect(parseFrontmatter('# Just a heading')).toEqual({})
  })
})

describe('readSpecs()', () => {
  it('parses layers and platforms, and skips the index', async () => {
    const specsPath = await seedSpecs({
      'a-spec.md': SPEC('a-spec', 'ui, bridge', 'figma'),
      'b-spec.md': SPEC('b-spec', 'canvas'),
      [INDEX_FILE]: '# generated index',
    })

    const specs = await readSpecs(specsPath)

    expect(specs).toHaveLength(2)
    expect(specs[0].name).toBe('a-spec')
    expect(specs[0].layers).toEqual(['ui', 'bridge'])
    expect(specs[0].platforms).toEqual(['figma'])
    expect(specs[1].layers).toEqual(['canvas'])
  })

  it('ignores unknown layer values', async () => {
    const specsPath = await seedSpecs({
      'weird.md': SPEC('weird', 'ui, teleportation'),
    })

    const specs = await readSpecs(specsPath)
    expect(specs[0].layers).toEqual(['ui'])
  })

  it('returns an empty array for a missing folder', async () => {
    expect(await readSpecs(path.join(tmpDir, 'nope'))).toEqual([])
  })
})

describe('skillsForLayers()', () => {
  it('expands <platform> for platform-specific layers', () => {
    const files = skillsForLayers(['bridge'], ['penpot'])
    expect(files).toContain('bridge/penpot/communication-pattern.md')
    expect(files.every((f) => !f.includes('<platform>'))).toBe(true)
  })

  it('expands to both platforms when none is declared', () => {
    const files = skillsForLayers(['canvas'], [])
    expect(files).toContain('canvas/figma/canvas-api.md')
    expect(files).toContain('canvas/penpot/canvas-api.md')
  })

  it('deduplicates across layers', () => {
    const files = skillsForLayers(['ui', 'ui'], ['figma'])
    expect(new Set(files).size).toBe(files.length)
  })

  it('covers every declared layer', () => {
    for (const layer of LAYERS) {
      expect(skillsForLayers([layer], ['figma']).length).toBeGreaterThan(0)
    }
  })
})

describe('injectBlock()', () => {
  it('appends the block when the file has none', async () => {
    const file = path.join(tmpDir, 'CLAUDE.md')
    await fs.writeFile(file, '# Project\n')

    expect(await injectBlock(file, 'BLOCK', { create: false })).toBe('updated')
    expect(await fs.readFile(file, 'utf-8')).toContain('BLOCK')
  })

  it('replaces an existing block instead of duplicating it', async () => {
    const file = path.join(tmpDir, 'CLAUDE.md')
    const block = renderPointerBlock('specs', [])
    await fs.writeFile(file, `# Project\n\n${block}\n`)

    await injectBlock(file, renderPointerBlock('docs/specs', []), {
      create: false,
    })

    const content = await fs.readFile(file, 'utf-8')
    expect(content.split(BLOCK_START)).toHaveLength(2)
    expect(content.split(BLOCK_END)).toHaveLength(2)
    expect(content).toContain('docs/specs')
    expect(content).toContain('# Project')
  })

  it('skips a missing file when create is false', async () => {
    const file = path.join(tmpDir, 'nope', 'AGENTS.md')
    expect(await injectBlock(file, 'BLOCK', { create: false })).toBe('skipped')
    expect(fs.existsSync(file)).toBe(false)
  })

  it('creates a missing file when create is true', async () => {
    const file = path.join(tmpDir, 'AGENTS.md')
    expect(await injectBlock(file, 'BLOCK', { create: true })).toBe('created')
    expect(await fs.readFile(file, 'utf-8')).toContain('BLOCK')
  })
})

describe('syncSpecs()', () => {
  it('writes the index and only touches configured assistants', async () => {
    await seedSpecs({
      'paywall.md': SPEC('paywall', 'ui, config'),
    })
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Plugin\n')

    await syncSpecs('specs')

    const index = await fs.readFile(
      path.join(tmpDir, 'specs', INDEX_FILE),
      'utf-8'
    )
    expect(index).toContain('paywall')
    expect(index).toContain('ui, config')

    expect(
      await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8')
    ).toContain(BLOCK_START)
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(false)
    expect(
      fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'project.mdc'))
    ).toBe(false)
  })

  it('creates the rules file of every configured assistant', async () => {
    await seedSpecs({ 'paywall.md': SPEC('paywall', 'ui') })

    await syncSpecs('specs', {
      assistants: ['codex', 'windsurf'],
      specsDir: 'specs',
      skillsPath: '.claude/skills/unoff-create-plugin',
    })

    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true)
    expect(
      fs.existsSync(path.join(tmpDir, '.windsurf', 'rules', 'project.md'))
    ).toBe(true)

    // Assistants outside the config stay untouched.
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false)
    expect(
      fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'project.mdc'))
    ).toBe(false)
  })

  it('inlines the role table only for assistants without an agent format', async () => {
    await seedSpecs({ 'paywall.md': SPEC('paywall', 'ui') })

    const agentsDir = path.join(tmpDir, 'skills', 'agents')
    await fs.ensureDir(agentsDir)
    await fs.writeFile(
      path.join(agentsDir, 'unoff-ui.md'),
      '---\nname: unoff-ui\ndescription: UI specialist.\nlayers: [ui]\n---\n\nBody.\n'
    )
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Plugin\n')

    await syncSpecs('specs', {
      assistants: ['claude', 'codex'],
      specsDir: 'specs',
      skillsPath: 'skills',
    })

    expect(
      await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8')
    ).not.toContain('Agent roles')
    const agentsMd = await fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf-8')
    expect(agentsMd).toContain('Agent roles')
    expect(agentsMd).toContain('`unoff-ui`')
  })

  it('is idempotent across runs', async () => {
    await seedSpecs({ 'paywall.md': SPEC('paywall', 'ui') })
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Plugin\n')

    await syncSpecs('specs')
    const once = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8')
    await syncSpecs('specs')
    const twice = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8')

    expect(twice).toBe(once)
    expect(twice.split(BLOCK_START)).toHaveLength(2)
  })

  it('picks up a spec added by hand', async () => {
    const specsPath = await seedSpecs({ 'a.md': SPEC('a', 'ui') })
    await syncSpecs('specs')

    await fs.writeFile(path.join(specsPath, 'b.md'), SPEC('b', 'canvas'))
    await syncSpecs('specs')

    const index = await fs.readFile(path.join(specsPath, INDEX_FILE), 'utf-8')
    expect(index).toContain('a')
    expect(index).toContain('b')
  })

  it('calls process.exit(1) when the folder does not exist', async () => {
    await expect(syncSpecs('nowhere')).rejects.toThrow(ProcessExitError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('removeSpecs()', () => {
  it('removes the specs folder when confirmed', async () => {
    const specsPath = await seedSpecs({ 'a.md': '# a' })

    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ confirm: true })

    await removeSpecs()

    expect(fs.existsSync(specsPath)).toBe(false)
  })

  it('does not remove the folder when cancelled', async () => {
    const specsPath = await seedSpecs({})

    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ confirm: false })

    await expect(removeSpecs()).rejects.toThrow(ProcessExitError)
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(fs.existsSync(specsPath)).toBe(true)
  })

  it('calls process.exit(1) if folder does not exist', async () => {
    mockPrompt.mockResolvedValueOnce({ specsDir: 'nonexistent' })

    await expect(removeSpecs()).rejects.toThrow(ProcessExitError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
