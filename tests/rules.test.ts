import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

import {
  MCP_SERVERS,
  emitRules,
  renderMcp,
  renderRules,
  wrapRules,
  detectPlatform,
  readPluginName,
  buildRulesContext,
  findLocalRules,
} from '../src/commands/rules.js'
import { ASSISTANTS, RulesContext } from '../src/commands/config.js'

let tmpDir: string

const SOURCE = `# {{pluginName}}

Expert {{platform}} plugin developer.

Skills: {{skillsPath}}/SKILL.md — canvas/{{platformSlug}}/canvas-api.md
Specs: {{specsDir}}/INDEX.md

{{#figma}}
Storage is \`figma.clientStorage\` — async.
{{/figma}}
{{#penpot}}
Storage is \`penpot.localStorage\` — sync and string-only.
{{/penpot}}
`

const CTX = (over: Partial<RulesContext> = {}): RulesContext => ({
  pluginName: 'Palette Buddy',
  platform: 'Figma',
  platformSlug: 'figma',
  skillsPath: '.claude/skills/unoff-create-plugin',
  specsDir: 'specs',
  ...over,
})

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unoff-rules-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.remove(tmpDir)
})

describe('renderRules()', () => {
  it('substitutes the context', () => {
    const out = renderRules(SOURCE, CTX())
    expect(out).toContain('# Palette Buddy')
    expect(out).toContain('Expert Figma plugin developer.')
    expect(out).toContain('canvas/figma/canvas-api.md')
    expect(out).toContain('specs/INDEX.md')
  })

  it('keeps only the matching platform section', () => {
    const figma = renderRules(SOURCE, CTX())
    expect(figma).toContain('figma.clientStorage')
    expect(figma).not.toContain('penpot.localStorage')

    const penpot = renderRules(
      SOURCE,
      CTX({ platform: 'Penpot', platformSlug: 'penpot' })
    )
    expect(penpot).toContain('penpot.localStorage')
    expect(penpot).not.toContain('figma.clientStorage')
  })

  it('does not HTML-escape paths and backticks', () => {
    const out = renderRules('{{skillsPath}}', CTX())
    expect(out).toBe('.claude/skills/unoff-create-plugin')
    expect(out).not.toContain('&#x2F;')
  })
})

describe('wrapRules()', () => {
  it('adds frontmatter only where the assistant needs it', () => {
    expect(wrapRules('BODY', 'claude', CTX())).toBe('BODY')
    expect(wrapRules('BODY', 'codex', CTX())).toBe('BODY')
    expect(wrapRules('BODY', 'copilot', CTX())).toBe('BODY')

    const cursor = wrapRules('BODY', 'cursor', CTX())
    expect(cursor.startsWith('---\n')).toBe(true)
    expect(cursor).toContain('alwaysApply: true')
    expect(cursor).toContain('Palette Buddy')

    expect(wrapRules('BODY', 'windsurf', CTX())).toContain('trigger: always_on')
  })
})

describe('renderMcp()', () => {
  it('uses the mcpServers shape as-is', () => {
    const out = renderMcp('figma', 'mcpServers') as Record<string, unknown>
    expect(out).toHaveProperty('mcpServers')
    expect(out.mcpServers).toEqual(MCP_SERVERS.figma)
  })

  it('marks HTTP servers with a type in the VS Code shape', () => {
    const out = renderMcp('figma', 'servers') as {
      servers: Record<string, Record<string, unknown>>
    }
    expect(out.servers.figma.type).toBe('http')
    // stdio entries keep no type
    expect(out.servers['figma-console'].type).toBeUndefined()
  })

  it('serves penpot servers for penpot', () => {
    const out = renderMcp('penpot', 'mcpServers') as Record<string, unknown>
    expect(Object.keys(out.mcpServers as object)).toEqual(['penpot'])
  })
})

describe('emitRules()', () => {
  it('writes an identical body everywhere, differing only in frontmatter', async () => {
    const body = renderRules(SOURCE, CTX())
    await emitRules(tmpDir, body, CTX(), ['claude', 'codex', 'copilot'])

    const claude = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8')
    const codex = await fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf-8')
    const copilot = await fs.readFile(
      path.join(tmpDir, '.github', 'copilot-instructions.md'),
      'utf-8'
    )

    expect(codex).toBe(claude)
    expect(copilot).toBe(claude)
  })

  it('writes MCP config where the assistant declares one', async () => {
    await emitRules(tmpDir, 'BODY', CTX(), ['cursor', 'copilot', 'codex'])

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'mcp.json'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '.vscode', 'mcp.json'))).toBe(true)
    // Codex declares none
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true)
  })

  it('merges MCP into an existing settings file instead of replacing it', async () => {
    const settings = path.join(tmpDir, '.claude', 'settings.json')
    await fs.ensureDir(path.dirname(settings))
    await fs.writeJson(settings, { permissions: { allow: ['Bash'] } })

    await emitRules(tmpDir, 'BODY', CTX(), ['claude'], { force: true })

    const merged = await fs.readJson(settings)
    expect(merged.permissions.allow).toEqual(['Bash'])
    expect(merged.mcpServers).toBeDefined()
  })

  it('leaves an existing rules file alone without force', async () => {
    const file = path.join(tmpDir, 'CLAUDE.md')
    await fs.writeFile(file, '# Hand written\n')

    const [result] = await emitRules(tmpDir, 'GENERATED', CTX(), ['claude'])

    expect(result.status).toBe('skipped')
    expect(await fs.readFile(file, 'utf-8')).toBe('# Hand written\n')
  })

  it('overwrites with force but carries the specs block over', async () => {
    const file = path.join(tmpDir, 'CLAUDE.md')
    await fs.writeFile(
      file,
      '# Old\n\n<!-- unoff:specs:start -->\nSPECS\n<!-- unoff:specs:end -->\n'
    )

    const [result] = await emitRules(tmpDir, 'GENERATED', CTX(), ['claude'], {
      force: true,
    })

    const content = await fs.readFile(file, 'utf-8')
    expect(result.status).toBe('overwritten')
    expect(content).toContain('GENERATED')
    expect(content).not.toContain('# Old')
    expect(content).toContain('<!-- unoff:specs:start -->')
    expect(content).toContain('SPECS')
  })

  it('writes nothing for assistants that were not asked for', async () => {
    await emitRules(tmpDir, 'BODY', CTX(), ['claude'])
    expect(fs.existsSync(path.join(tmpDir, '.cursor'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, '.windsurf'))).toBe(false)
  })
})

describe('project detection', () => {
  it('reads penpot from a public manifest', async () => {
    await fs.ensureDir(path.join(tmpDir, 'public'))
    await fs.writeJson(path.join(tmpDir, 'public', 'manifest.json'), {})
    expect(detectPlatform(tmpDir)).toBe('penpot')
  })

  it('reads figma from a root manifest', async () => {
    await fs.writeJson(path.join(tmpDir, 'manifest.json'), {})
    expect(detectPlatform(tmpDir)).toBe('figma')
  })

  it('returns null when there is no manifest', () => {
    expect(detectPlatform(tmpDir)).toBeNull()
  })

  it('reads the plugin name from package.json', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'my-plugin' })
    expect(readPluginName(tmpDir)).toBe('my-plugin')
  })

  it('falls back to the directory name', () => {
    expect(readPluginName(tmpDir)).toBe(path.basename(tmpDir))
  })
})

describe('buildRulesContext()', () => {
  it('prefers the configured platform over detection', async () => {
    await fs.writeJson(path.join(tmpDir, 'manifest.json'), {})

    const ctx = await buildRulesContext(tmpDir, {
      assistants: ['claude'],
      specsDir: 'specs',
      skillsPath: 'skills',
      platform: 'penpot',
      pluginName: 'Configured',
    })

    expect(ctx.platformSlug).toBe('penpot')
    expect(ctx.platform).toBe('Penpot')
    expect(ctx.pluginName).toBe('Configured')
  })

  it('falls back to detection, then to figma', async () => {
    const ctx = await buildRulesContext(tmpDir, {
      assistants: ['claude'],
      specsDir: 'specs',
      skillsPath: 'skills',
    })
    expect(ctx.platformSlug).toBe('figma')
  })
})

describe('findLocalRules()', () => {
  it('finds the rules next to a skills checkout', async () => {
    const dir = path.join(tmpDir, 'skills', 'rules')
    await fs.ensureDir(dir)
    await fs.writeFile(path.join(dir, 'plugin.md'), 'BODY')

    expect(await findLocalRules(tmpDir, 'skills')).toBe('BODY')
  })

  it('returns null when nothing local exists', async () => {
    expect(await findLocalRules(tmpDir, 'nowhere')).toBeNull()
  })
})

describe('assistant registry — MCP', () => {
  it('declares a shape whenever it declares a file', () => {
    for (const a of ASSISTANTS) {
      expect(Boolean(a.mcpFile)).toBe(Boolean(a.mcpShape))
    }
  })
})
