import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import { spawnSync } from 'child_process'
import {
  ASSISTANTS,
  AssistantId,
  getAssistant,
  resolveConfig,
  UnoffConfig,
} from './config.js'
import { SKILLS_REPO } from './add.js'

export const AGENTS_SOURCE_DIR = 'agents'

export interface AgentDef {
  name: string
  frontmatter: Record<string, string>
  body: string
}

export function parseAgent(content: string, fallbackName: string): AgentDef {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { name: fallbackName, frontmatter: {}, body: content.trim() }
  }

  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (kv) frontmatter[kv[1]] = kv[2].trim()
  }

  return {
    name: frontmatter.name || fallbackName,
    frontmatter,
    body: match[2].trim(),
  }
}

export function renderAgent(agent: AgentDef, keep: string[]): string {
  const lines = keep
    .filter((k) => agent.frontmatter[k] !== undefined)
    .map((k) => `${k}: ${agent.frontmatter[k]}`)

  return `---\n${lines.join('\n')}\n---\n\n${agent.body}\n`
}

export function renderAgentRoles(agents: AgentDef[]): string {
  const rows = agents
    .map((a) => {
      const layers = a.frontmatter.layers ?? '—'
      return `| \`${a.name}\` | ${layers.replace(/^\[|\]$/g, '')} | ${a.frontmatter.description ?? ''} |`
    })
    .join('\n')

  return `### Agent roles

This project defines specialist roles per architecture layer. There is no agent
primitive here, so adopt the matching role yourself: when a task falls in a
layer below, follow that role's remit and load the skill files for its layers.

| Role | Layers | Remit |
| ---- | ------ | ----- |
${rows}

Always finish an implementation by applying the \`unoff-conformance-reviewer\`
checklist to the diff before declaring it done.`
}

export async function findLocalAgents(
  cwd: string,
  skillsPath?: string
): Promise<AgentDef[]> {
  const candidates = [
    skillsPath ? path.resolve(cwd, skillsPath) : null,
    skillsPath ? path.resolve(cwd, skillsPath, '..') : null,
    path.join(cwd, '.claude', 'skills', 'unoff-create-plugin'),
    path.join(cwd, '.claude', 'skills'),
    path.join(cwd, 'skills'),
  ].filter((p): p is string => p !== null)

  for (const base of candidates) {
    const agents = await readAgentDir(path.join(base, AGENTS_SOURCE_DIR))
    if (agents.length) return agents
  }
  return []
}

export async function fetchAgentsFromSkills(
  cwd: string,
  skillsPath?: string
): Promise<AgentDef[]> {
  const local = await findLocalAgents(cwd, skillsPath)
  if (local.length) return local

  const tmp = path.join(
    cwd,
    '.unoff-agents-tmp-' + Math.random().toString(36).slice(2, 8)
  )
  try {
    const result = spawnSync(
      'git',
      ['clone', '--depth', '1', '--quiet', SKILLS_REPO, tmp],
      { encoding: 'utf-8' }
    )
    if (result.status !== 0) {
      throw new Error(result.stderr || 'git clone failed')
    }
    return await readAgentDir(path.join(tmp, AGENTS_SOURCE_DIR))
  } finally {
    await fs.remove(tmp)
  }
}

export async function readAgentDir(dir: string): Promise<AgentDef[]> {
  if (!fs.existsSync(dir)) return []

  const files = (await fs.readdir(dir))
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()

  const agents: AgentDef[] = []
  for (const file of files) {
    const content = await fs.readFile(path.join(dir, file), 'utf-8')
    agents.push(parseAgent(content, path.basename(file, '.md')))
  }
  return agents
}

export interface EmitResult {
  assistant: AssistantId
  written: string[]
  degraded: boolean
}

export async function emitAgents(
  cwd: string,
  agents: AgentDef[],
  assistants: AssistantId[]
): Promise<EmitResult[]> {
  const results: EmitResult[] = []

  for (const id of assistants) {
    const assistant = getAssistant(id)
    const written: string[] = []

    if (!assistant.agentsDir || !assistant.agentFile) {
      results.push({ assistant: id, written, degraded: true })
      continue
    }

    const dir = path.join(cwd, assistant.agentsDir)
    await fs.ensureDir(dir)

    for (const agent of agents) {
      const file = assistant.agentFile(agent.name)
      await fs.writeFile(
        path.join(dir, file),
        renderAgent(
          agent,
          assistant.agentFrontmatter ?? ['name', 'description']
        ),
        'utf-8'
      )
      written.push(path.join(assistant.agentsDir, file))
    }

    results.push({ assistant: id, written, degraded: false })
  }

  return results
}

export async function addAgents(config?: UnoffConfig, cwdArg?: string) {
  const cwd = cwdArg ?? process.cwd()
  const resolved = config
    ? { config, source: 'file' as const }
    : await resolveConfig(cwd)

  const spinner = ora('Fetching agent definitions...').start()

  let agents: AgentDef[]
  try {
    agents = await fetchAgentsFromSkills(cwd, resolved.config.skillsPath)
  } catch (error) {
    spinner.fail(chalk.red('Could not fetch agent definitions'))
    console.error(
      chalk.yellow(
        `\nAgents live in ${SKILLS_REPO}. Check your network, or add the skills\n` +
          `submodule first with \`unoff add skills\`.\n`
      )
    )
    throw error
  }

  if (!agents.length) {
    spinner.fail(chalk.red('No agent definition found'))
    process.exit(1)
  }

  spinner.text = 'Writing agents...'
  const results = await emitAgents(cwd, agents, resolved.config.assistants)
  spinner.succeed(
    chalk.green(
      `Emitted ${chalk.white(String(agents.length))} agents for ${chalk.white(
        String(resolved.config.assistants.length)
      )} assistant(s)`
    )
  )

  console.log()
  for (const result of results) {
    const assistant = getAssistant(result.assistant)
    if (result.degraded) {
      console.log(
        `  ${chalk.yellow('roles'.padEnd(10))}${chalk.gray(
          `${assistant.label} — no agent format, folded into ${assistant.rulesFile}`
        )}`
      )
    } else {
      console.log(
        `  ${chalk.green('agents'.padEnd(10))}${chalk.gray(
          `${assistant.label} — ${result.written.length} files in ${assistant.agentsDir}/`
        )}`
      )
    }
  }

  if (resolved.source !== 'file') {
    console.log(
      chalk.gray(
        `\n  Targets ${resolved.source === 'detected' ? 'auto-detected' : 'defaulted'}. ` +
          `Run \`unoff ai\` to choose them explicitly.`
      )
    )
  }

  console.log(
    chalk.cyan(
      '\n💡 Run `unoff sync specs` to wire the roles into rules files.\n'
    )
  )

  return agents
}

export function assistantSummary(): string {
  return ASSISTANTS.map(
    (a) => `${a.label}${a.agentsDir ? '' : ' (roles only)'}`
  ).join(', ')
}
