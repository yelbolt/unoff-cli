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
  UnoffConfig,
  detectAssistants,
  getAssistant,
  readConfig,
  writeConfig,
} from './config.js'
import { addAgents } from './agents.js'
import { addRules } from './rules.js'
import { syncSpecs, resolveSpecsDir } from './specs.js'
import {
  SKILLS_PACKAGE,
  SKILLS_PATH,
  CLAUDE_MARKETPLACE,
  CLAUDE_PLUGIN,
} from './add.js'

type Piece = 'skills' | 'rules' | 'agents' | 'specs'

export interface ConfigureAiOptions {
  cwd?: string
  platform?: Platform
  pluginName?: string
  intro?: boolean
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

  const config: UnoffConfig = {
    assistants: selected,
    specsDir: specsDir as string,
    skillsPath: existing?.skillsPath ?? SKILLS_PATH,
    platform: options.platform ?? existing?.platform,
    pluginName: options.pluginName ?? existing?.pluginName,
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
    const specsPath = path.resolve(cwd, config.specsDir)
    if (!fs.existsSync(specsPath)) {
      console.log(
        chalk.yellow(
          `\n⚠️  No specs folder at "${config.specsDir}" — skipping sync.`
        )
      )
      console.log(
        chalk.gray('   Create your first spec with `unoff add specs`.')
      )
      skipped.push('specs')
    } else {
      await syncSpecs(config.specsDir, config, cwd)
      done.push('specs')
    }
  }

  printSummary(config, done, skipped)
}

async function installSkills(
  cwd: string,
  config: UnoffConfig
): Promise<boolean> {
  console.log(chalk.cyan('\n📚 Installing skills...\n'))

  const result = spawnSync(
    'npx',
    [
      '-y',
      'skills@latest',
      'add',
      SKILLS_PACKAGE,
      '-s',
      'unoff-create-plugin',
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

  const canonical = path.join(cwd, config.skillsPath)
  const fanout = path.join(cwd, '.claude', 'skills', 'unoff-create-plugin')

  if (
    fs.existsSync(fanout) &&
    path.resolve(fanout) !== path.resolve(canonical)
  ) {
    await fs.ensureDir(path.dirname(canonical))
    await fs.move(fanout, canonical, { overwrite: true })
  }

  for (const stray of ['.agents', '.kiro']) {
    await fs.remove(path.join(cwd, stray))
  }

  console.log(chalk.green(`\n✅ Skills at ${chalk.white(config.skillsPath)}`))
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
    `  ${chalk.gray('$')} unoff specs sync     ${chalk.gray('# after editing specs')}`
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
