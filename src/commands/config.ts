import path from 'path'
import fs from 'fs-extra'

export const CONFIG_FILE = 'unoff.config.json'

export const LAYERS = ['canvas', 'bridge', 'ui', 'config', 'externals'] as const
export const PLATFORMS = ['figma', 'penpot'] as const

export type Layer = (typeof LAYERS)[number]
export type Platform = (typeof PLATFORMS)[number]

export type AssistantId = 'claude' | 'copilot' | 'cursor' | 'windsurf' | 'codex'

export interface Assistant {
  id: AssistantId
  label: string
  rulesFile: string
  createRules: boolean
  agentsDir: string | null
  skillsDir: string | null
  agentFile?: (name: string) => string
  agentFrontmatter?: string[]
  rulesFrontmatter?: (ctx: RulesContext) => string
  mcpFile: string | null
  mcpShape: McpShape | null
  urlEnvSyntax: ((name: string) => string) | null
  recommended: boolean
  notes: string
}

export type McpShape = 'mcpServers' | 'servers' | 'serverUrl' | 'toml'

export interface RulesContext {
  pluginName: string
  platform: string
  platformSlug: Platform
  skillsPath: string
  specsDir: string
}

export const ASSISTANTS: Assistant[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    rulesFile: 'CLAUDE.md',
    createRules: true,
    agentsDir: path.join('.claude', 'agents'),
    skillsDir: path.join('.claude', 'skills'),
    agentFile: (name) => `${name}.md`,
    agentFrontmatter: [
      'name',
      'description',
      'layers',
      'model',
      'effort',
      'maxTurns',
    ],
    mcpFile: path.join('.claude', 'settings.json'),
    mcpShape: 'mcpServers',
    urlEnvSyntax: (name) => `\${${name}}`,
    recommended: true,
    notes: 'skills + subagents + CLAUDE.md',
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    rulesFile: path.join('.github', 'copilot-instructions.md'),
    createRules: true,
    agentsDir: path.join('.github', 'agents'),
    skillsDir: null,
    agentFile: (name) => `${name}.agent.md`,
    agentFrontmatter: ['name', 'description'],
    mcpFile: path.join('.vscode', 'mcp.json'),
    mcpShape: 'servers',
    urlEnvSyntax: null,
    recommended: true,
    notes: 'custom agents + instructions',
  },
  {
    id: 'codex',
    label: 'ChatGPT / Codex',
    rulesFile: 'AGENTS.md',
    createRules: true,
    agentsDir: null,
    skillsDir: path.join('.agents', 'skills'),
    mcpFile: path.join('.codex', 'config.toml'),
    mcpShape: 'toml',
    urlEnvSyntax: null,
    recommended: true,
    notes: 'AGENTS.md + .agents/skills',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    rulesFile: path.join('.cursor', 'rules', 'project.mdc'),
    createRules: true,
    agentsDir: null,
    skillsDir: null,
    rulesFrontmatter: (ctx) =>
      `description: Core project rules for ${ctx.pluginName} (${ctx.platform} plugin).\nglobs:\nalwaysApply: true`,
    mcpFile: path.join('.cursor', 'mcp.json'),
    mcpShape: 'mcpServers',
    urlEnvSyntax: null,
    recommended: true,
    notes: 'rules + MCP — no agent primitive',
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    rulesFile: path.join('.windsurf', 'rules', 'project.md'),
    createRules: true,
    agentsDir: null,
    skillsDir: path.join('.windsurf', 'skills'),
    rulesFrontmatter: (ctx) =>
      `trigger: always_on\ndescription: Core project rules for ${ctx.pluginName} (${ctx.platform} plugin).`,
    mcpFile: path.join('.windsurf', 'mcp.json'),
    mcpShape: 'serverUrl',
    urlEnvSyntax: (name) => `\${env:${name}}`,
    recommended: false,
    notes: 'rules + MCP — no agent primitive',
  },
]

export const ASSISTANT_IDS = ASSISTANTS.map((a) => a.id)

export function getAssistant(id: AssistantId): Assistant {
  const found = ASSISTANTS.find((a) => a.id === id)
  if (!found) throw new Error(`Unknown assistant: ${id}`)
  return found
}

export interface UnoffConfig {
  assistants: AssistantId[]
  specsDir: string
  skillsPath: string
  platform?: Platform
  pluginName?: string
  penpotUrl?: string
}

export const SKILL_NAME = 'unoff-create-plugin'

export function resolveSkillsPath(assistants: AssistantId[]): string {
  for (const id of ['claude', 'codex', 'windsurf'] as AssistantId[]) {
    if (!assistants.includes(id)) continue
    const dir = getAssistant(id).skillsDir
    if (dir) return path.join(dir, SKILL_NAME)
  }
  return path.join('.agents', 'skills', SKILL_NAME)
}

export function skillsDirsFor(assistants: AssistantId[]): string[] {
  return assistants
    .map((id) => getAssistant(id).skillsDir)
    .filter((d): d is string => d !== null)
    .map((d) => path.join(d, SKILL_NAME))
}

export const DEFAULT_CONFIG: UnoffConfig = {
  assistants: ASSISTANTS.filter((a) => a.recommended).map((a) => a.id),
  specsDir: 'specs',
  skillsPath: path.join('.claude', 'skills', SKILL_NAME),
}

export function configPath(cwd: string): string {
  return path.join(cwd, CONFIG_FILE)
}

export async function readConfig(cwd: string): Promise<UnoffConfig | null> {
  const file = configPath(cwd)
  if (!fs.existsSync(file)) return null

  try {
    const raw = await fs.readJson(file)
    const assistants = Array.isArray(raw.assistants)
      ? raw.assistants.filter((a: string): a is AssistantId =>
          (ASSISTANT_IDS as string[]).includes(a)
        )
      : DEFAULT_CONFIG.assistants

    return {
      assistants,
      specsDir:
        typeof raw.specsDir === 'string'
          ? raw.specsDir
          : DEFAULT_CONFIG.specsDir,
      skillsPath:
        typeof raw.skillsPath === 'string'
          ? raw.skillsPath
          : DEFAULT_CONFIG.skillsPath,
      platform: (PLATFORMS as readonly string[]).includes(raw.platform)
        ? (raw.platform as Platform)
        : undefined,
      pluginName:
        typeof raw.pluginName === 'string' && raw.pluginName
          ? raw.pluginName
          : undefined,
      penpotUrl:
        typeof raw.penpotUrl === 'string' && raw.penpotUrl
          ? raw.penpotUrl.replace(/\/+$/, '')
          : undefined,
    }
  } catch {
    return null
  }
}

export async function writeConfig(
  cwd: string,
  config: UnoffConfig
): Promise<void> {
  await fs.writeJson(configPath(cwd), config, { spaces: 2 })
}

export function detectAssistants(cwd: string): AssistantId[] {
  return ASSISTANTS.filter((a) => {
    if (fs.existsSync(path.join(cwd, a.rulesFile))) return true
    if (a.agentsDir && fs.existsSync(path.join(cwd, a.agentsDir))) return true
    return false
  }).map((a) => a.id)
}

export async function resolveConfig(cwd: string): Promise<{
  config: UnoffConfig
  source: 'file' | 'detected' | 'default'
}> {
  const fromFile = await readConfig(cwd)
  if (fromFile) return { config: fromFile, source: 'file' }

  const detected = detectAssistants(cwd)
  if (detected.length) {
    return {
      config: { ...DEFAULT_CONFIG, assistants: detected },
      source: 'detected',
    }
  }

  return { config: { ...DEFAULT_CONFIG }, source: 'default' }
}
