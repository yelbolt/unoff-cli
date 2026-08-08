import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { spawnSync } from 'child_process'
import {
  ASSISTANTS,
  AssistantId,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  Platform,
  SKILL_NAME,
  UnoffConfig,
  resolveSkillsPath,
  skillsDirsFor,
  detectAssistants,
  getAssistant,
  readConfig,
  writeConfig,
} from './config.js'
import { addAgents } from './agents.js'
import { addRules } from './rules.js'
import {
  SPEC_TEMPLATE,
  resolveSpecsDir,
  syncSpecs,
  toTitleCase,
} from './specs.js'
import {
  SKILLS_PACKAGE,
  SKILLS_REPO,
  CLAUDE_MARKETPLACE,
  CLAUDE_PLUGIN,
  extractSubmodulePath,
  linkSkill,
  skillLinkPaths,
} from './add.js'
import {
  FIGMA_TOKEN_VAR,
  PENPOT_CLOUD,
  PENPOT_TOKEN_VAR,
  detectPlatform,
} from './rules.js'

type Piece = 'skills' | 'rules' | 'agents' | 'specs'

export interface ConfigureAiOptions {
  cwd?: string
  platform?: Platform
  pluginName?: string
}

export async function configureAi(options: ConfigureAiOptions = {}) {
  const cwd = options.cwd ?? process.cwd()
  const existing = await readConfig(cwd)
  const detected = detectAssistants(cwd)

  console.log()
  console.log(chalk.bold('  🤖 Which AI assistants does this project target?'))
  console.log(
    chalk.gray(
      '  Rules, agents and specs are installed in the format each one reads.'
    )
  )
  console.log()

  if (detected.length) {
    console.log(
      chalk.gray(
        `  Detected in this project: ${detected
          .map((id) => getAssistant(id).label)
          .join(', ')}`
      )
    )
    console.log()
  }

  const preselected = existing?.assistants.length
    ? existing.assistants
    : detected.length
      ? detected
      : DEFAULT_CONFIG.assistants

  const { assistants } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'assistants',
      message: 'Which assistants does this project target?',
      choices: ASSISTANTS.map((a) => ({
        name: `${a.label.padEnd(16)} ${chalk.gray(a.notes)}`,
        value: a.id,
        checked: preselected.includes(a.id),
      })),
      validate: (input: unknown[]) =>
        input.length > 0 || 'Pick at least one assistant.',
    },
  ])

  const selected = assistants as AssistantId[]

  const { specsDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'specsDir',
      message: 'Where do functional specs live?',
      default:
        existing?.specsDir ??
        (await resolveSpecsDir(cwd)) ??
        DEFAULT_CONFIG.specsDir,
    },
  ])

  const platform =
    options.platform ?? existing?.platform ?? detectPlatform(cwd) ?? 'figma'

  const penpotUrl =
    platform === 'penpot' ? await askPenpotUrl(existing?.penpotUrl) : undefined

  const config: UnoffConfig = {
    assistants: selected,
    specsDir: specsDir as string,
    skillsPath: resolveSkillsPath(selected),
    platform,
    pluginName: options.pluginName ?? existing?.pluginName,
    penpotUrl,
  }

  await writeConfig(cwd, config)
  console.log(chalk.green(`\n✅ Wrote ${chalk.white(CONFIG_FILE)}`))

  const noAgentFormat = selected.filter((id) => !getAssistant(id).agentsDir)
  if (noAgentFormat.length) {
    console.log(
      chalk.gray(
        `\n  ${noAgentFormat.map((id) => getAssistant(id).label).join(', ')} ` +
          `${noAgentFormat.length === 1 ? 'has' : 'have'} no agent file format —\n` +
          `  agents are folded into their rules file as a role table instead.`
      )
    )
  }

  const { pieces } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'pieces',
      message: 'Install now?',
      choices: [
        {
          name: `Skills  ${chalk.gray('— architecture docs (how we build)')}`,
          value: 'skills',
          checked: !fs.existsSync(path.join(cwd, config.skillsPath)),
        },
        {
          name: `Rules   ${chalk.gray('— project conventions + MCP config')}`,
          value: 'rules',
          checked: true,
        },
        {
          name: `Agents  ${chalk.gray('— 5 layer specialists + reviewer')}`,
          value: 'agents',
          checked: true,
        },
        {
          name: `Specs   ${chalk.gray('— index + routing block in rules files')}`,
          value: 'specs',
          checked: true,
        },
      ],
    },
  ])

  const chosen = pieces as Piece[]
  const done: string[] = []
  const skipped: string[] = []

  if (chosen.includes('skills')) {
    if (await installSkills(cwd, config)) done.push('skills')
    else skipped.push('skills')
  }

  if (chosen.includes('rules')) {
    try {
      await addRules(config, { cwd })
      done.push('rules')
    } catch {
      skipped.push('rules')
    }
  }

  if (chosen.includes('agents')) {
    try {
      await addAgents(config, cwd)
      done.push('agents')
    } catch {
      skipped.push('agents')
    }
  }

  if (chosen.includes('specs')) {
    const seeded = await seedStarterSpec(cwd, config)
    await syncSpecs(config.specsDir, config, cwd)
    done.push(seeded ? 'specs (starter spec added)' : 'specs')
  }

  if (chosen.includes('rules')) await askTokens(cwd, config)

  printSummary(config, done, skipped)
}

async function askPenpotUrl(existing?: string): Promise<string> {
  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Penpot instance URL (Cloud, or your self-hosted domain):',
      default: existing ?? PENPOT_CLOUD,
      filter: (input: string) => input.trim().replace(/\/+$/, ''),
      validate: (input: string) =>
        /^https?:\/\//.test(input) || 'Must start with http:// or https://',
    },
  ])
  return url as string
}

async function askTokens(cwd: string, config: UnoffConfig) {
  const variable =
    config.platform === 'penpot' ? PENPOT_TOKEN_VAR : FIGMA_TOKEN_VAR
  const where =
    config.platform === 'penpot'
      ? 'Penpot → Account → Integrations'
      : 'Figma → Settings → Security → Personal access tokens'

  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      mask: '*',
      message: `${variable} (optional, from ${where}) — stored in .env.local:`,
    },
  ])

  const value = (token as string)?.trim()
  if (!value) {
    console.log(
      chalk.gray(`\n  No token stored. Set ${variable} in .env.local later.`)
    )
    return
  }

  const envPath = path.join(cwd, '.env.local')
  const previous = fs.existsSync(envPath)
    ? await fs.readFile(envPath, 'utf-8')
    : ''
  const line = `${variable}='${value}'`
  const next = new RegExp(`^${variable}=.*$`, 'm').test(previous)
    ? previous.replace(new RegExp(`^${variable}=.*$`, 'm'), line)
    : `${previous.trimEnd()}\n${line}\n`.trimStart()

  await fs.writeFile(envPath, next, 'utf-8')
  console.log(chalk.green(`\n✅ ${variable} written to .env.local`))

  const cannotExpand = config.assistants.filter(
    (id) => getAssistant(id).mcpFile && !getAssistant(id).urlEnvSyntax
  )
  if (cannotExpand.length && config.platform === 'penpot') {
    console.log(
      chalk.yellow(
        `\n⚠️  ${cannotExpand.map((id) => getAssistant(id).label).join(', ')} ` +
          `do not expand env vars inside a server URL.\n` +
          `   Their MCP files keep a YOUR_${PENPOT_TOKEN_VAR} placeholder — paste the\n` +
          `   token there yourself, and keep those files out of git.`
      )
    )
  }
}

async function seedStarterSpec(
  cwd: string,
  config: UnoffConfig
): Promise<boolean> {
  const specsPath = path.resolve(cwd, config.specsDir)

  if (fs.existsSync(specsPath)) {
    const existing = (await fs.readdir(specsPath)).filter(
      (f) => f.endsWith('.md') && f !== 'INDEX.md'
    )
    if (existing.length) return false
  }

  const name = 'example-feature'
  await fs.ensureDir(specsPath)
  await fs.writeFile(
    path.join(specsPath, `${name}.md`),
    SPEC_TEMPLATE({
      name,
      title: toTitleCase(name),
    }),
    'utf-8'
  )

  console.log(
    chalk.gray(
      `\n  Seeded ${path.join(config.specsDir, `${name}.md`)} — rewrite it, or replace it with\n` +
        `  your own via \`unoff add specs\`.`
    )
  )
  return true
}

async function linkExistingSubmodule(
  cwd: string,
  config: UnoffConfig
): Promise<boolean> {
  const gitmodulesPath = path.join(cwd, '.gitmodules')
  if (!fs.existsSync(gitmodulesPath)) return false

  const submodulePath = extractSubmodulePath(
    await fs.readFile(gitmodulesPath, 'utf-8'),
    SKILLS_REPO
  )
  if (!submodulePath) return false
  if (!fs.existsSync(path.join(cwd, submodulePath, SKILL_NAME))) return false

  console.log(
    chalk.cyan(`\n📚 Linking skills from the ${submodulePath}/ submodule...\n`)
  )

  await pruneSkillsDirs(cwd, config)
  for (const relative of skillLinkPaths(config)) {
    const outcome = await linkSkill(cwd, submodulePath, relative)
    const label =
      outcome === 'skipped' ? chalk.gray('skipped') : chalk.green(outcome)
    console.log(`  ${label.padEnd(19)}${chalk.gray(relative + '/')}`)
  }

  return true
}

export async function pruneSkillsDirs(
  cwd: string,
  config: Pick<UnoffConfig, 'assistants' | 'skillsPath'>
): Promise<string[]> {
  const keep = new Set([...skillsDirsFor(config.assistants), config.skillsPath])
  const removed: string[] = []

  for (const entry of await fs.readdir(cwd)) {
    if (!entry.startsWith('.')) continue

    const relative = path.join(entry, 'skills', SKILL_NAME)
    if (keep.has(relative)) continue
    if (!fs.existsSync(path.join(cwd, relative))) continue

    await fs.remove(path.join(cwd, relative))
    removed.push(relative)

    // Take the parents with it only while they are empty.
    for (const parent of [path.join(entry, 'skills'), entry]) {
      const dir = path.join(cwd, parent)
      if (fs.existsSync(dir) && (await fs.readdir(dir)).length === 0) {
        await fs.remove(dir)
      }
    }
  }

  return removed
}

async function installSkills(
  cwd: string,
  config: UnoffConfig
): Promise<boolean> {
  const linked = await linkExistingSubmodule(cwd, config)
  if (linked) return true

  console.log(chalk.cyan('\n📚 Installing skills...\n'))

  const result = spawnSync(
    'npx',
    [
      '-y',
      'skills@latest',
      'add',
      SKILLS_PACKAGE,
      '-s',
      SKILL_NAME,
      '-y',
      '--copy',
    ],
    { cwd, encoding: 'utf-8', stdio: 'inherit' }
  )

  if (result.status !== 0) {
    console.log(
      chalk.yellow(
        `\n⚠️  skills.sh install failed. Alternative: \`unoff add skills\` (git submodule).`
      )
    )
    return false
  }

  await pruneSkillsDirs(cwd, config)

  const canonical = path.join(cwd, config.skillsPath)
  if (!fs.existsSync(canonical)) {
    const source = skillsDirsFor(config.assistants)
      .map((d) => path.join(cwd, d))
      .find((d) => fs.existsSync(d))
    if (source) await fs.copy(source, canonical)
  }

  const installed = [
    ...new Set([config.skillsPath, ...skillsDirsFor(config.assistants)]),
  ].filter((d) => fs.existsSync(path.join(cwd, d)))

  console.log()
  for (const dir of installed) {
    console.log(`  ${chalk.green('skills'.padEnd(10))}${chalk.gray(dir + '/')}`)
  }

  const withoutDir = config.assistants.filter(
    (id) => !getAssistant(id).skillsDir
  )
  if (withoutDir.length) {
    console.log(
      chalk.gray(
        `\n  ${withoutDir.map((id) => getAssistant(id).label).join(', ')} ` +
          `${withoutDir.length === 1 ? 'reads' : 'read'} no skills directory —\n` +
          `  their rules point at ${config.skillsPath}/ instead.`
      )
    )
  }

  return true
}

function printSummary(config: UnoffConfig, done: string[], skipped: string[]) {
  console.log(chalk.bold('\n  Summary\n'))

  for (const id of config.assistants) {
    const a = getAssistant(id)
    const bits = [`rules → ${a.rulesFile}`]
    if (a.agentsDir) bits.push(`agents → ${a.agentsDir}/`)
    else bits.push('agents → role table in rules')
    console.log(
      `  ${chalk.cyan(a.label.padEnd(18))}${chalk.gray(bits.join('  ·  '))}`
    )
  }

  console.log()
  if (done.length) {
    console.log(`  ${chalk.green('installed')}  ${done.join(', ')}`)
  }
  if (skipped.length) {
    console.log(`  ${chalk.yellow('skipped')}    ${skipped.join(', ')}`)
  }

  console.log(chalk.bold('\n  Next\n'))
  if (!done.includes('specs')) {
    console.log(
      `  ${chalk.gray('$')} unoff add specs      ${chalk.gray('# describe what your plugin does')}`
    )
  }
  console.log(
    `  ${chalk.gray('$')} unoff sync specs     ${chalk.gray('# after editing specs')}`
  )
  if (config.assistants.includes('claude')) {
    console.log(
      chalk.gray(
        `\n  Claude Code users can get skills + agents as a plugin instead:\n` +
          `    /plugin marketplace add ${CLAUDE_MARKETPLACE}\n` +
          `    /plugin install ${CLAUDE_PLUGIN}`
      )
    )
  }
  console.log()
}

export async function showAiStatus() {
  const cwd = process.cwd()
  const config = await readConfig(cwd)

  console.log()
  if (!config) {
    console.log(
      chalk.yellow(`  No ${CONFIG_FILE} — run \`unoff ai\` to create one.`)
    )
    const detected = detectAssistants(cwd)
    if (detected.length) {
      console.log(
        chalk.gray(
          `  Detected anyway: ${detected.map((id) => getAssistant(id).label).join(', ')}`
        )
      )
    }
    console.log()
    return
  }

  console.log(chalk.bold(`  ${CONFIG_FILE}`))
  console.log()

  for (const id of config.assistants) {
    const a = getAssistant(id)
    const rules = fs.existsSync(path.join(cwd, a.rulesFile))
    const agents =
      a.agentsDir && fs.existsSync(path.join(cwd, a.agentsDir))
        ? fs.readdirSync(path.join(cwd, a.agentsDir)).length
        : 0

    const rulesMark = rules ? chalk.green('✓') : chalk.red('✗')
    const agentsMark = !a.agentsDir
      ? chalk.gray('n/a')
      : agents
        ? chalk.green(`${agents}`)
        : chalk.red('0')

    console.log(
      `  ${chalk.cyan(a.label.padEnd(18))}rules ${rulesMark}  agents ${agentsMark}  ${chalk.gray(a.rulesFile)}`
    )
  }

  const specsPath = path.join(cwd, config.specsDir)
  const specCount = fs.existsSync(specsPath)
    ? fs
        .readdirSync(specsPath)
        .filter((f) => f.endsWith('.md') && f !== 'INDEX.md').length
    : 0

  console.log()
  console.log(
    `  ${chalk.cyan('Specs'.padEnd(18))}${specCount} in ${chalk.gray(config.specsDir + '/')}`
  )
  console.log(
    `  ${chalk.cyan('Skills'.padEnd(18))}${
      fs.existsSync(path.join(cwd, config.skillsPath))
        ? chalk.green('✓')
        : chalk.red('✗')
    } ${chalk.gray(config.skillsPath)}`
  )
  console.log()
}
