import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

import {
  MCP_SERVERS,
  PENPOT_CLOUD,
  PENPOT_TOKEN_VAR,
  emitRules,
  mcpServers,
  renderMcp,
  renderMcpToml,
  renderRules,
  wrapRules,
  detectPlatform,
  readPluginName,
  buildRulesContext,
  findLocalRules,
} from '../src/commands/rules.js'
import {
  ASSISTANTS,
  RulesContext,
  getAssistant,
} from '../src/commands/config.js'

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

describe('MCP_SERVERS', () => {
  it('gives both platforms a hosted and a machine-local endpoint', () => {
    for (const platform of ['figma', 'penpot'] as const) {
      const scopes = MCP_SERVERS[platform].map((s) => s.scope)
      expect(scopes).toContain('remote')
      expect(scopes).toContain('local')
    }
  })

  it('declares either a url or a command for every server', () => {
    for (const servers of Object.values(MCP_SERVERS)) {
      for (const server of servers) {
        expect(Boolean(server.url) !== Boolean(server.command)).toBe(true)
      }
    }
  })
})

describe('renderMcp()', () => {
  it('uses a plain url for the mcpServers shape', () => {
    const out = renderMcp('figma', 'mcpServers') as {
      mcpServers: Record<string, Record<string, unknown>>
    }
    expect(out.mcpServers.figma).toEqual({ url: 'https://mcp.figma.com/mcp' })
  })

  it('marks HTTP servers with a type in the VS Code shape', () => {
    const out = renderMcp('figma', 'servers') as {
      servers: Record<string, Record<string, unknown>>
    }
    expect(out.servers.figma.type).toBe('http')
    // stdio entries keep no type
    expect(out.servers['figma-console'].type).toBeUndefined()
  })

  it('uses serverUrl for Windsurf — a plain url is ignored there', () => {
    const out = renderMcp('figma', 'serverUrl') as {
      mcpServers: Record<string, Record<string, unknown>>
    }
    expect(out.mcpServers.figma.serverUrl).toBe('https://mcp.figma.com/mcp')
    expect(out.mcpServers.figma.url).toBeUndefined()
  })

  it('leaves stdio entries untouched across every shape', () => {
    for (const shape of ['mcpServers', 'servers', 'serverUrl'] as const) {
      const out = renderMcp('figma', shape) as {
        [k: string]: Record<string, Record<string, unknown>>
      }
      const key = shape === 'servers' ? 'servers' : 'mcpServers'
      expect(out[key]['figma-console'].command).toBe('npx')
      expect(out[key]['figma-console'].env).toEqual({
        FIGMA_ACCESS_TOKEN: 'figd_YOUR_TOKEN_HERE',
      })
    }
  })

  it('serves penpot endpoints for penpot', () => {
    const out = renderMcp('penpot', 'mcpServers') as {
      mcpServers: Record<string, unknown>
    }
    expect(Object.keys(out.mcpServers)).toEqual(['penpot', 'penpot-dev'])
  })
})

describe('Penpot instance and token', () => {
  it('uses the configured instance URL, trailing slash trimmed', () => {
    const [remote] = mcpServers('penpot', {
      penpotUrl: 'https://penpot.acme.internal/',
    })
    expect(remote.url).toContain('https://penpot.acme.internal/mcp/stream')
    expect(remote.url).not.toContain('.internal//mcp')
  })

  it('falls back to Penpot Cloud', () => {
    const [remote] = mcpServers('penpot')
    expect(remote.url?.startsWith(PENPOT_CLOUD)).toBe(true)
  })

  it('references the env var where the assistant expands it in a url', () => {
    const claude = mcpServers('penpot', {
      urlEnvSyntax: getAssistant('claude').urlEnvSyntax,
    })[0]
    expect(claude.url).toContain(`\${${PENPOT_TOKEN_VAR}}`)

    const windsurf = mcpServers('penpot', {
      urlEnvSyntax: getAssistant('windsurf').urlEnvSyntax,
    })[0]
    expect(windsurf.url).toContain(`\${env:${PENPOT_TOKEN_VAR}}`)
  })

  it('keeps a placeholder — never a value — where it does not expand', () => {
    for (const id of ['cursor', 'copilot', 'codex'] as const) {
      const [remote] = mcpServers('penpot', {
        urlEnvSyntax: getAssistant(id).urlEnvSyntax,
      })
      expect(remote.url).toContain(`YOUR_${PENPOT_TOKEN_VAR}`)
      expect(remote.url).not.toContain('${')
    }
  })

  it('leaves the local dev server untouched', () => {
    const servers = mcpServers('penpot', { penpotUrl: 'https://x.test' })
    const local = servers.find((s) => s.scope === 'local')
    expect(local?.args).toContain('http://localhost:4401/mcp')
  })

  it('ignores the context for figma', () => {
    const servers = mcpServers('figma', { penpotUrl: 'https://x.test' })
    expect(servers.every((s) => !s.url?.includes('x.test'))).toBe(true)
  })
})

describe('renderMcpToml()', () => {
  it('emits a table per server, url for HTTP', () => {
    const toml = renderMcpToml(MCP_SERVERS.figma)
    expect(toml).toContain('[mcp_servers.figma]')
    expect(toml).toContain('url = "https://mcp.figma.com/mcp"')
  })

  it('emits command, args and env_vars for stdio', () => {
    const toml = renderMcpToml(MCP_SERVERS.figma)
    expect(toml).toContain('[mcp_servers.figma-console]')
    expect(toml).toContain('command = "npx"')
    expect(toml).toContain('args = ["-y", "figma-console-mcp@latest"]')
    expect(toml).toContain('env_vars = ["FIGMA_ACCESS_TOKEN"]')
    expect(toml).not.toContain('figd_YOUR_TOKEN_HERE')
  })

  it('never emits both url and command for one server', () => {
    for (const servers of Object.values(MCP_SERVERS)) {
      for (const block of renderMcpToml(servers).split('\n\n')) {
        expect(block.includes('url = ') && block.includes('command = ')).toBe(
          false
        )
      }
    }
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

  it('writes MCP config in each assistant own format', async () => {
    await emitRules(tmpDir, 'BODY', CTX(), ['cursor', 'copilot', 'codex'])

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'mcp.json'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '.vscode', 'mcp.json'))).toBe(true)

    const toml = await fs.readFile(
      path.join(tmpDir, '.codex', 'config.toml'),
      'utf-8'
    )
    expect(toml).toContain('[mcp_servers.figma]')
    expect(() => JSON.parse(toml)).toThrow()
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
