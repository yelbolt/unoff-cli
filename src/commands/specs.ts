import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { SKILLS_PATH } from './add.js'
import {
  LAYERS,
  PLATFORMS,
  Layer,
  Platform,
  getAssistant,
  resolveConfig,
  UnoffConfig,
} from './config.js'
import {
  AgentDef,
  findLocalAgents,
  readAgentDir,
  renderAgentRoles,
} from './agents.js'

export { LAYERS, PLATFORMS }
export type { Layer, Platform }

export const INDEX_FILE = 'INDEX.md'

export const BLOCK_START = '<!-- unoff:specs:start -->'
export const BLOCK_END = '<!-- unoff:specs:end -->'

export const LAYER_SKILLS: Record<Layer, string[]> = {
  canvas: [
    'canvas/<platform>/canvas-api.md',
    'canvas/<platform>/data-storage.md',
    'canvas/<platform>/document-generation.md',
  ],
  bridge: [
    'bridge/<platform>/communication-pattern.md',
    'bridge/<platform>/bridge-functions.md',
  ],
  ui: [
    'ui/component-library.md',
    'ui/component-patterns.md',
    'ui/state-management.md',
    'ui/types-system.md',
    'ui/i18n.md',
  ],
  config: [
    'config/global-config.md',
    'config/feature-flags.md',
    'config/credits-system.md',
  ],
  externals: ['ui/external-services.md', 'externals/payment-systems.md'],
}

export interface SpecMeta {
  file: string
  name: string
  description: string
  layers: Layer[]
  platforms: Platform[]
  status: string
}

export function toTitleCase(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const SPEC_TEMPLATE = (opts: {
  name: string
  title: string
  layers: Layer[]
  platforms: Platform[]
}) => `---
name: ${opts.name}
description: Functional spec — what this feature does and the rules it must respect. Use when implementing or changing ${opts.title}.
layers: [${opts.layers.join(', ')}]
platforms: [${opts.platforms.join(', ')}]
status: draft
---

# ${opts.title}

## Problem

What the user cannot do today, and why it matters.

## User flow

1. Entry point — where the user starts.
2. Steps — what they see and do.
3. Outcome — what changed when they are done.

## Rules

Constraints the implementation must respect: limits, permissions, plan tiers,
edge cases, empty and error states.

## Acceptance criteria

Observable checks that decide whether this is done. One line each, phrased so
the outcome is verifiable rather than judged.

- [ ] Given <context>, when <action>, then <observable outcome>
- [ ] ...

## Out of scope

What this spec deliberately does not cover — so the agent does not invent it.

## Implementation notes

Anything already decided: message types, store atoms, config keys, existing
components to reuse. Leave empty if undecided.
`

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const out: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].trim()
  }
  return out
}

function parseList<T extends string>(
  raw: string | undefined,
  allowed: readonly T[]
): T[] {
  if (!raw) return []
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) =>
      s
        .trim()
        .replace(/^["']|["']$/g, '')
        .toLowerCase()
    )
    .filter((s): s is T => (allowed as readonly string[]).includes(s))
}

export async function readSpecs(specsPath: string): Promise<SpecMeta[]> {
  if (!fs.existsSync(specsPath)) return []

  const files = (await fs.readdir(specsPath))
    .filter((f) => f.endsWith('.md') && f !== INDEX_FILE)
    .sort()

  const specs: SpecMeta[] = []
  for (const file of files) {
    const content = await fs.readFile(path.join(specsPath, file), 'utf-8')
    const fm = parseFrontmatter(content)
    specs.push({
      file,
      name: fm.name || path.basename(file, '.md'),
      description: fm.description || '',
      layers: parseList(fm.layers, LAYERS),
      platforms: parseList(fm.platforms, PLATFORMS),
      status: fm.status || 'draft',
    })
  }
  return specs
}

export function skillsForLayers(
  layers: Layer[],
  platforms: Platform[]
): string[] {
  const targets = platforms.length ? platforms : [...PLATFORMS]
  const out = new Set<string>()

  for (const layer of layers) {
    for (const entry of LAYER_SKILLS[layer]) {
      if (entry.includes('<platform>')) {
        for (const p of targets) out.add(entry.replace('<platform>', p))
      } else {
        out.add(entry)
      }
    }
  }
  return [...out]
}

export function renderIndex(specs: SpecMeta[], specsDir: string): string {
  const rows = specs.length
    ? specs
        .map((s) => {
          const layers = s.layers.length ? s.layers.join(', ') : '—'
          const platforms = s.platforms.length ? s.platforms.join(', ') : 'all'
          const desc = s.description.replace(/\|/g, '\\|')
          return `| [\`${s.name}\`](./${s.file}) | ${desc} | ${layers} | ${platforms} | ${s.status} |`
        })
        .join('\n')
    : '| _no spec yet_ | | | | |'

  return `<!-- Generated by \`unoff specs sync\`. Do not edit by hand. -->

# Functional specs

What this product does. The **how** lives in the unoff skill library at
\`${SKILLS_PATH}/\` — these two are meant to be read together.

| Spec | Description | Layers | Platforms | Status |
| ---- | ----------- | ------ | --------- | ------ |
${rows}

## How to use this index

1. Find the spec covering the feature you are asked to build or change.
2. Read it in full — **Rules**, **Acceptance criteria** and **Out of scope** are
   binding. The acceptance criteria are what "done" means: check each one before
   declaring the work finished.
3. Load the implementation skills for the layers it declares:

| Layer | Load from \`${SKILLS_PATH}/\` |
| ----- | ---------------------------- |
${LAYERS.map((l) => `| \`${l}\` | ${LAYER_SKILLS[l].map((f) => `\`${f}\``).join(', ')} |`).join('\n')}

\`<platform>\` resolves to \`figma\` or \`penpot\` depending on the target.

4. Implement the spec's **what** using the skills' **how**. When the two
   conflict, the skills win on architecture and conventions; the spec wins on
   product behaviour.

Specs live in \`${specsDir}/\`. Add one with \`unoff add specs\`, then run
\`unoff specs sync\` to refresh this index.
`
}

export function renderPointerBlock(
  specsDir: string,
  specs: SpecMeta[],
  roles?: string
): string {
  const list = specs.length
    ? specs
        .map(
          (s) =>
            `- \`${specsDir}/${s.file}\` — ${s.description || s.name}${
              s.layers.length ? ` _(layers: ${s.layers.join(', ')})_` : ''
            }`
        )
        .join('\n')
    : `- _none yet — create one with \`unoff add specs\`_`

  return `${BLOCK_START}

## Functional specs

This project pairs **implementation skills** (how we build) with **functional
specs** (what the product does). Read both before writing code.

- **How** → \`${SKILLS_PATH}/\` — architecture, conventions, platform APIs
- **What** → \`${specsDir}/${INDEX_FILE}\` — product behaviour and rules

When a task maps to a spec below, load that spec **and** the skill files for
the layers it declares in its frontmatter (\`layers:\`). The mapping from layer
to skill files is in \`${specsDir}/${INDEX_FILE}\`.

${list}
${roles ? `\n${roles}\n` : ''}
${BLOCK_END}`
}

export async function injectBlock(
  filePath: string,
  block: string,
  { create }: { create: boolean }
): Promise<'updated' | 'created' | 'skipped'> {
  const exists = fs.existsSync(filePath)

  if (!exists && !create) return 'skipped'

  if (!exists) {
    await fs.ensureDir(path.dirname(filePath))
    await fs.writeFile(filePath, `# Agent instructions\n\n${block}\n`, 'utf-8')
    return 'created'
  }

  const content = await fs.readFile(filePath, 'utf-8')
  const startIdx = content.indexOf(BLOCK_START)
  const endIdx = content.indexOf(BLOCK_END)

  let next: string
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    next =
      content.slice(0, startIdx) +
      block +
      content.slice(endIdx + BLOCK_END.length)
  } else {
    next = `${content.trimEnd()}\n\n${block}\n`
  }

  if (next === content) return 'skipped'

  await fs.writeFile(filePath, next, 'utf-8')
  return 'updated'
}

export async function resolveSpecsDir(cwd: string): Promise<string | null> {
  for (const candidate of ['specs', 'docs/specs', '.specs']) {
    if (fs.existsSync(path.join(cwd, candidate))) return candidate
  }
  return null
}

async function loadAgentRoles(
  cwd: string,
  skillsPath?: string
): Promise<string | undefined> {
  const source = await findLocalAgents(cwd, skillsPath)
  if (source.length) return renderAgentRoles(source)

  for (const dir of ['.claude/agents', '.github/agents']) {
    const agents: AgentDef[] = await readAgentDir(path.join(cwd, dir))
    if (agents.length) return renderAgentRoles(agents)
  }
  return undefined
}

export async function syncSpecs(
  specsDirArg?: string,
  configArg?: UnoffConfig,
  cwdArg?: string
) {
  const cwd = cwdArg ?? process.cwd()
  const resolved = configArg
    ? { config: configArg, source: 'file' as const }
    : await resolveConfig(cwd)

  let specsDir =
    specsDirArg ??
    (await resolveSpecsDir(cwd)) ??
    (resolved.source === 'file' ? resolved.config.specsDir : undefined)
  if (!specsDir) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'specsDir',
        message: 'Where is your specs folder?',
        default: 'specs',
      },
    ])
    specsDir = answer.specsDir as string
  }

  const specsPath = path.resolve(cwd, specsDir)
  if (!fs.existsSync(specsPath)) {
    console.error(chalk.red(`\n❌ Specs folder "${specsDir}" does not exist.`))
    console.error(chalk.yellow('\nCreate one with `unoff add specs`.\n'))
    process.exit(1)
  }

  const spinner = ora('Syncing specs...').start()

  const specs = await readSpecs(specsPath)
  await fs.writeFile(
    path.join(specsPath, INDEX_FILE),
    renderIndex(specs, specsDir),
    'utf-8'
  )

  const roles = await loadAgentRoles(cwd, resolved.config.skillsPath)

  const results: [string, string][] = []
  for (const id of resolved.config.assistants) {
    const assistant = getAssistant(id)
    const block = renderPointerBlock(
      specsDir,
      specs,
      assistant.agentsDir ? undefined : roles
    )
    const outcome = await injectBlock(
      path.resolve(cwd, assistant.rulesFile),
      block,
      { create: assistant.createRules }
    )
    results.push([`${assistant.rulesFile} (${assistant.label})`, outcome])
  }

  spinner.succeed(
    chalk.green(
      `Synced ${chalk.white(String(specs.length))} spec${specs.length === 1 ? '' : 's'} → ${chalk.white(path.join(specsDir, INDEX_FILE))}`
    )
  )

  console.log()
  for (const [rel, outcome] of results) {
    const label =
      outcome === 'created'
        ? chalk.green('created')
        : outcome === 'updated'
          ? chalk.cyan('updated')
          : chalk.gray('skipped')
    console.log(`  ${label.padEnd(18)}${chalk.gray(rel)}`)
  }

  if (!specs.length) {
    console.log(
      chalk.yellow('\n⚠️  No spec found. Create one with `unoff add specs`.')
    )
  }

  console.log(chalk.cyan('\n✨ Agents will now read your specs.\n'))
}

export async function addSpecs() {
  const cwd = process.cwd()

  const { specsDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'specsDir',
      message: 'Where do you want to create the specs folder?',
      default: (await resolveSpecsDir(cwd)) ?? 'specs',
    },
  ])

  const { specName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'specName',
      message: 'Name of your spec (kebab-case):',
      default: 'my-spec',
    },
  ])

  const specsPath = path.resolve(cwd, specsDir)
  const specFilePath = path.join(specsPath, `${specName}.md`)

  if (fs.existsSync(specFilePath)) {
    console.error(
      chalk.red(
        `\n❌ Spec file "${specName}.md" already exists at "${specsDir}".\n`
      )
    )
    process.exit(1)
  }

  const { layers } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'layers',
      message: 'Which layers does this spec touch? (routes agents to skills)',
      choices: LAYERS.map((l) => ({ name: l, value: l })),
      default: ['ui'],
    },
  ])

  const { platforms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'platforms',
      message: 'Which platforms?',
      choices: PLATFORMS.map((p) => ({ name: p, value: p })),
      default: [...PLATFORMS],
    },
  ])

  const spinner = ora('Creating spec...').start()

  await fs.ensureDir(specsPath)
  await fs.writeFile(
    specFilePath,
    SPEC_TEMPLATE({
      name: specName,
      title: toTitleCase(specName),
      layers: layers as Layer[],
      platforms: platforms as Platform[],
    })
  )

  spinner.succeed(
    chalk.green(
      `Spec created at ${chalk.white(path.join(specsDir, `${specName}.md`))}`
    )
  )

  console.log(chalk.cyan('\n📝 Next steps:\n'))
  console.log(
    chalk.white(`  1. Fill in ${path.join(specsDir, `${specName}.md`)}`)
  )
  console.log(chalk.white(`  2. unoff specs sync`))
  console.log(
    chalk.gray(
      `\n  Sync regenerates ${path.join(specsDir, INDEX_FILE)} and points\n` +
        `  CLAUDE.md, AGENTS.md, Cursor and Copilot at your specs, so agents\n` +
        `  read them alongside the unoff implementation skills.`
    )
  )
  console.log(chalk.cyan('\n✨ Happy coding!\n'))
}
