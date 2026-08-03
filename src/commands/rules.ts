import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import Mustache from 'mustache'
import { spawnSync } from 'child_process'
import {
  AssistantId,
  McpShape,
  Platform,
  RulesContext,
  UnoffConfig,
  getAssistant,
  resolveConfig,
} from './config.js'
import { SKILLS_REPO } from './add.js'

export const RULES_SOURCE_DIR = 'rules'
export const RULES_FILE = 'plugin.md'

export interface McpServer {
  name: string
  scope: 'local' | 'remote'
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export const PENPOT_CLOUD = 'https://design.penpot.app'
export const FIGMA_TOKEN_VAR = 'FIGMA_ACCESS_TOKEN'
export const PENPOT_TOKEN_VAR = 'PENPOT_USER_TOKEN'

export interface McpContext {
  penpotUrl?: string
  urlEnvSyntax?: ((name: string) => string) | null
}

export function mcpServers(
  platform: Platform,
  ctx: McpContext = {}
): McpServer[] {
  if (platform === 'figma') return MCP_SERVERS.figma

  const base = (ctx.penpotUrl || PENPOT_CLOUD).replace(/\/+$/, '')
  const token = ctx.urlEnvSyntax
    ? ctx.urlEnvSyntax(PENPOT_TOKEN_VAR)
    : `YOUR_${PENPOT_TOKEN_VAR}`

  return MCP_SERVERS.penpot.map((server) =>
    server.name === 'penpot'
      ? { ...server, url: `${base}/mcp/stream?userToken=${token}` }
      : server
  )
}

export const MCP_SERVERS: Record<Platform, McpServer[]> = {
  figma: [
    { name: 'figma', scope: 'remote', url: 'https://mcp.figma.com/mcp' },
    {
      name: 'figma-desktop',
      scope: 'local',
      url: 'http://127.0.0.1:3845/mcp',
    },
    {
      name: 'figma-console',
      scope: 'local',
      command: 'npx',
      args: ['-y', 'figma-console-mcp@latest'],
      env: { FIGMA_ACCESS_TOKEN: 'figd_YOUR_TOKEN_HERE' },
    },
  ],
  penpot: [
    {
      name: 'penpot',
      scope: 'remote',
      url: `${PENPOT_CLOUD}/mcp/stream?userToken=YOUR_PENPOT_USER_TOKEN`,
    },
    {
      name: 'penpot-dev',
      scope: 'local',
      command: 'npx',
      args: ['-y', 'mcp-remote', 'http://localhost:4401/mcp', '--allow-http'],
    },
  ],
}

function stdioEntry(server: McpServer) {
  return {
    command: server.command,
    ...(server.args ? { args: server.args } : {}),
    ...(server.env ? { env: server.env } : {}),
  }
}

function tomlValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`
  return JSON.stringify(value)
}

export function renderMcpToml(servers: McpServer[]): string {
  return servers
    .map((server) => {
      const lines = [`[mcp_servers.${server.name}]`]
      if (server.url) {
        lines.push(`url = ${tomlValue(server.url)}`)
      } else {
        lines.push(`command = ${tomlValue(server.command)}`)
        if (server.args) lines.push(`args = ${tomlValue(server.args)}`)
        if (server.env) {
          lines.push(`env_vars = ${tomlValue(Object.keys(server.env))}`)
        }
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

export function renderMcp(
  platform: Platform,
  shape: McpShape,
  ctx: McpContext = {}
) {
  const servers = mcpServers(platform, ctx)

  const entries = servers.map((server): [string, unknown] => {
    if (!server.url) return [server.name, stdioEntry(server)]

    switch (shape) {
      case 'servers':
        return [server.name, { type: 'http', url: server.url }]
      case 'serverUrl':
        return [server.name, { serverUrl: server.url }]
      default:
        return [server.name, { url: server.url }]
    }
  })

  const key = shape === 'servers' ? 'servers' : 'mcpServers'
  return { [key]: Object.fromEntries(entries) }
}

export function renderRules(source: string, ctx: RulesContext): string {
  return Mustache.render(
    source,
    {
      ...ctx,
      figma: ctx.platformSlug === 'figma',
      penpot: ctx.platformSlug === 'penpot',
    },
    {},
    { escape: (v: unknown) => String(v) }
  )
}

export function wrapRules(
  body: string,
  assistant: AssistantId,
  ctx: RulesContext
): string {
  const frontmatter = getAssistant(assistant).rulesFrontmatter?.(ctx)
  return frontmatter ? `---\n${frontmatter}\n---\n\n${body}` : body
}

export async function findLocalRules(
  cwd: string,
  skillsPath?: string
): Promise<string | null> {
  const candidates = [
    skillsPath ? path.resolve(cwd, skillsPath) : null,
    skillsPath ? path.resolve(cwd, skillsPath, '..') : null,
    path.join(cwd, '.claude', 'skills', 'unoff-create-plugin'),
    path.join(cwd, '.claude', 'skills'),
    path.join(cwd, 'skills'),
  ].filter((p): p is string => p !== null)

  for (const base of candidates) {
    const file = path.join(base, RULES_SOURCE_DIR, RULES_FILE)
    if (fs.existsSync(file)) return fs.readFile(file, 'utf-8')
  }
  return null
}

export async function fetchRules(
  cwd: string,
  skillsPath?: string
): Promise<string> {
  const local = await findLocalRules(cwd, skillsPath)
  if (local) return local

  const tmp = path.join(
    cwd,
    '.unoff-rules-tmp-' + Math.random().toString(36).slice(2, 8)
  )
  try {
    const result = spawnSync(
      'git',
      ['clone', '--depth', '1', '--quiet', SKILLS_REPO, tmp],
      { encoding: 'utf-8' }
    )
    if (result.status !== 0)
      throw new Error(result.stderr || 'git clone failed')

    const file = path.join(tmp, RULES_SOURCE_DIR, RULES_FILE)
    if (!fs.existsSync(file)) throw new Error('no rules found in unoff-skills')
    return await fs.readFile(file, 'utf-8')
  } finally {
    await fs.remove(tmp)
  }
}

export interface RulesResult {
  assistant: AssistantId
  rules: string
  status: 'created' | 'overwritten' | 'skipped'
  mcp: string | null
}

const SPECS_BLOCK = /<!-- unoff:specs:start -->[\s\S]*<!-- unoff:specs:end -->/

export async function emitRules(
  cwd: string,
  body: string,
  ctx: RulesContext,
  assistants: AssistantId[],
  { force = false, penpotUrl }: { force?: boolean; penpotUrl?: string } = {}
): Promise<RulesResult[]> {
  const results: RulesResult[] = []

  for (const id of assistants) {
    const assistant = getAssistant(id)
    const rulesPath = path.join(cwd, assistant.rulesFile)
    const exists = fs.existsSync(rulesPath)

    let status: RulesResult['status'] = 'created'

    if (exists && !force) {
      status = 'skipped'
    } else {
      let next = wrapRules(body, id, ctx)

      if (exists) {
        const previous = await fs.readFile(rulesPath, 'utf-8')
        const block = previous.match(SPECS_BLOCK)
        if (block) next = `${next.trimEnd()}\n\n${block[0]}\n`
        status = 'overwritten'
      }

      await fs.ensureDir(path.dirname(rulesPath))
      await fs.writeFile(rulesPath, next, 'utf-8')
    }

    let mcp: string | null = null
    if (assistant.mcpFile && assistant.mcpShape) {
      const mcpPath = path.join(cwd, assistant.mcpFile)
      if (!fs.existsSync(mcpPath) || force) {
        await fs.ensureDir(path.dirname(mcpPath))

        const mcpCtx = {
          penpotUrl,
          urlEnvSyntax: assistant.urlEnvSyntax,
        }

        if (assistant.mcpShape === 'toml') {
          await fs.writeFile(
            mcpPath,
            renderMcpToml(mcpServers(ctx.platformSlug, mcpCtx)) + '\n',
            'utf-8'
          )
        } else {
          let existing: Record<string, unknown> = {}
          if (fs.existsSync(mcpPath)) {
            try {
              existing = await fs.readJson(mcpPath)
            } catch {
              existing = {}
            }
          }

          await fs.writeJson(
            mcpPath,
            {
              ...existing,
              ...renderMcp(ctx.platformSlug, assistant.mcpShape, mcpCtx),
            },
            { spaces: 2 }
          )
        }

        mcp = assistant.mcpFile
      }
    }

    results.push({ assistant: id, rules: assistant.rulesFile, status, mcp })
  }

  return results
}

export function detectPlatform(cwd: string): Platform | null {
  const manifest = path.join(cwd, 'manifest.json')
  const publicManifest = path.join(cwd, 'public', 'manifest.json')

  if (fs.existsSync(publicManifest)) return 'penpot'
  if (fs.existsSync(manifest)) return 'figma'
  return null
}

export function readPluginName(cwd: string): string {
  const pkg = path.join(cwd, 'package.json')
  if (fs.existsSync(pkg)) {
    try {
      const { name } = fs.readJsonSync(pkg)
      if (typeof name === 'string' && name) return name
    } catch {
      // fall through to the directory name
    }
  }
  return path.basename(cwd)
}

export async function buildRulesContext(
  cwd: string,
  config: UnoffConfig
): Promise<RulesContext> {
  const platformSlug =
    config.platform ?? detectPlatform(cwd) ?? ('figma' as Platform)

  return {
    pluginName: config.pluginName ?? readPluginName(cwd),
    platform: platformSlug === 'penpot' ? 'Penpot' : 'Figma',
    platformSlug,
    skillsPath: config.skillsPath,
    specsDir: config.specsDir,
  }
}

export async function addRules(
  configArg?: UnoffConfig,
  { force = false, cwd = process.cwd() }: { force?: boolean; cwd?: string } = {}
) {
  const resolved = configArg
    ? { config: configArg, source: 'file' as const }
    : await resolveConfig(cwd)

  const ctx = await buildRulesContext(cwd, resolved.config)
  const spinner = ora('Fetching rules...').start()

  let body: string
  try {
    body = await fetchRules(cwd, resolved.config.skillsPath)
  } catch (error) {
    spinner.fail(chalk.red('Could not fetch the rules source'))
    console.error(
      chalk.yellow(
        `\nRules live in ${SKILLS_REPO}. Check your network, or add the skills\n` +
          `submodule first with \`unoff add skills\`.\n`
      )
    )
    throw error
  }

  spinner.text = 'Writing rules...'
  const rendered = renderRules(body, ctx)
  const results = await emitRules(
    cwd,
    rendered,
    ctx,
    resolved.config.assistants,
    { force, penpotUrl: resolved.config.penpotUrl }
  )

  const written = results.filter((r) => r.status !== 'skipped').length
  spinner.succeed(
    chalk.green(
      `Rules for ${chalk.white(ctx.platform)} — ${chalk.white(String(written))}/${results.length} assistant(s) written`
    )
  )

  console.log()
  for (const result of results) {
    const assistant = getAssistant(result.assistant)
    const label =
      result.status === 'skipped'
        ? chalk.gray('skipped')
        : result.status === 'overwritten'
          ? chalk.cyan('replaced')
          : chalk.green('created')
    const extra = result.mcp ? chalk.gray(`  ·  mcp → ${result.mcp}`) : ''
    console.log(
      `  ${label.padEnd(19)}${chalk.cyan(assistant.label.padEnd(18))}${chalk.gray(result.rules)}${extra}`
    )
  }

  if (results.some((r) => r.status === 'skipped')) {
    console.log(
      chalk.gray(
        '\n  Existing rules were left untouched. Use `--force` to regenerate them\n' +
          '  (the specs block is carried over either way).'
      )
    )
  }
  console.log()

  return results
}
