import chalk from 'chalk'
import {
  WORKERS,
  WORKER_SCRIPTS,
  SKILLS_REPO,
  SKILLS_PACKAGE,
  CLAUDE_MARKETPLACE,
  CLAUDE_PLUGIN,
} from './add.js'
import { ASSISTANTS } from './config.js'

const AVAILABLE_PLATFORMS = ['figma-plugin', 'penpot-plugin']
const COMING_SOON_PLATFORMS = ['sketch-plugin', 'framer-plugin']

const SERVICES = [
  { name: 'supabase', label: 'Supabase   (Database & Authentication)' },
  { name: 'mixpanel', label: 'Mixpanel   (Analytics)' },
  { name: 'sentry', label: 'Sentry     (Error Monitoring)' },
  { name: 'notion', label: 'Notion     (Announcements & Onboarding)' },
]

function row(cmd: string, desc: string) {
  return `  ${chalk.cyan(cmd.padEnd(36))}${chalk.white(desc)}`
}

function workerRow(name: string) {
  const scripts = Object.keys(WORKER_SCRIPTS[name] ?? {})
  const scriptLabel = scripts.length
    ? chalk.gray(`→ adds: ${scripts.join(', ')}`)
    : ''
  return `  ${chalk.yellow(('  ' + name).padEnd(36))}${scriptLabel}`
}

export function showHelp() {
  console.log()
  console.log(
    chalk.bold.white('  unoff') + chalk.gray(' — Unofficial Plugin CLI')
  )
  console.log()

  console.log(chalk.bold('USAGE'))
  console.log(
    `  ${chalk.cyan('unoff')} ${chalk.white('<command>')} ${chalk.gray('[options]')}`
  )
  console.log()

  console.log(chalk.bold('COMMANDS'))
  console.log()

  console.log(chalk.dim('  — Project'))
  console.log(row('create <platform>', 'Scaffold a new plugin project'))
  console.log(
    chalk.gray(`  ${''.padEnd(36)}Available: ${AVAILABLE_PLATFORMS.join(', ')}`)
  )
  console.log(
    chalk.gray(
      `  ${''.padEnd(36)}Coming soon: ${COMING_SOON_PLATFORMS.join(', ')}`
    )
  )
  console.log(
    chalk.gray(
      `  ${''.padEnd(36)}Services (toggleable, all enabled by default):`
    )
  )
  for (const s of SERVICES) {
    console.log(chalk.gray(`  ${''.padEnd(38)}· ${s.label}`))
  }
  console.log()

  console.log(chalk.dim('  — Development'))
  console.log(row('dev', 'Start development mode  (npm run start:dev)'))
  console.log(row('build', 'Build for production    (npm run build:prod)'))
  console.log(
    row('check', 'Lint + typecheck        (npm run lint && typecheck)')
  )
  console.log(row('format', 'Format source code      (npm run format)'))
  console.log()

  console.log(chalk.dim('  — Add'))
  console.log(
    row('add worker <name>', 'Add a Cloudflare Worker as a git submodule')
  )
  console.log(chalk.gray('  Available workers:'))
  for (const name of Object.keys(WORKERS)) {
    console.log(workerRow(name))
  }
  console.log(row('add skills', 'Add the unoff-skills repo as a git submodule'))
  console.log(chalk.gray(`  ${''.padEnd(36)}Repo: ${SKILLS_REPO}`))
  console.log(
    chalk.gray(
      `  ${''.padEnd(36)}Or copy them: npx skills add ${SKILLS_PACKAGE}`
    )
  )
  console.log(
    row('add specs', 'Scaffold a functional spec (product behaviour)')
  )
  console.log(
    chalk.gray(`  ${''.padEnd(36)}Declares layers → routes agents to skills`)
  )
  console.log(row('add rules', 'Write project rules + MCP for your assistants'))
  console.log(
    chalk.gray(`  ${''.padEnd(36)}--force to regenerate existing files`)
  )
  console.log(
    row('add agents', 'Install the 5 unoff agents for your assistants')
  )
  console.log(
    chalk.gray(`  ${''.padEnd(36)}Claude + Copilot: files · others: role table`)
  )
  console.log()

  console.log(chalk.dim('  — AI'))
  console.log(row('ai', 'Choose assistants, then install skills/agents/specs'))
  console.log(row('ai status', 'Show what is configured and installed'))
  console.log()

  console.log(chalk.dim('  — Specs'))
  console.log(
    row('specs sync [dir]', 'Rebuild the specs index + agent pointers')
  )
  console.log(
    chalk.gray(`  ${''.padEnd(36)}Writes to your configured assistants only`)
  )
  console.log()

  console.log(chalk.dim('  — Remove'))
  console.log(
    row(
      'remove worker <name>',
      'Remove a worker submodule and clean up package.json'
    )
  )
  console.log(row('remove skills', 'Remove the skills submodule'))
  console.log(row('remove specs', 'Remove the local specs folder'))
  console.log()

  console.log(chalk.bold('AI ASSISTANTS'))
  console.log()
  console.log(
    chalk.gray(
      '  Three pieces, installed per assistant in the format it reads:'
    )
  )
  console.log(
    chalk.gray(
      '    skills  how we build   ·   specs  what it does   ·   agents  who does it'
    )
  )
  console.log(
    chalk.gray(
      '    rules + MCP are generated too — templates ship none of them'
    )
  )
  console.log()
  console.log(
    `  ${chalk.gray('$')} unoff ai${chalk.gray('    # pick assistants, install all three')}`
  )
  console.log()
  for (const a of ASSISTANTS) {
    const agents = a.agentsDir
      ? chalk.green(a.agentsDir + '/')
      : chalk.gray('role table in rules')
    console.log(
      `  ${chalk.cyan(a.label.padEnd(17))}${chalk.gray(a.rulesFile.padEnd(34))}${agents}`
    )
  }
  console.log()
  console.log(
    chalk.gray('  Cursor, Windsurf and Codex have no agent file format —')
  )
  console.log(
    chalk.gray('  agents degrade into a role table inside their rules file.')
  )
  console.log()

  console.log(chalk.bold('CLAUDE CODE'))
  console.log()
  console.log(
    chalk.gray('  Claude users can get skills + agents as a plugin instead:')
  )
  console.log()
  console.log(
    `  ${chalk.gray('>')} /plugin marketplace add ${chalk.cyan(CLAUDE_MARKETPLACE)}`
  )
  console.log(
    `  ${chalk.gray('>')} /plugin install ${chalk.cyan(CLAUDE_PLUGIN)}`
  )
  console.log()
  console.log(chalk.gray('  Skills without the plugin — pick one:'))
  const skillsCmds: [string, string][] = [
    ['unoff add skills', 'git submodule, pinned in your repo'],
    [`npx skills add ${SKILLS_PACKAGE}`, 'copied, works with any agent'],
  ]
  for (const [cmd, note] of skillsCmds) {
    console.log(
      `  ${chalk.gray('$')} ${cmd.padEnd(38)}${chalk.gray(`# ${note}`)}`
    )
  }
  console.log()

  console.log(chalk.bold('EXAMPLES'))
  console.log()
  console.log(`  ${chalk.gray('$')} unoff create figma-plugin`)
  console.log(`  ${chalk.gray('$')} unoff create penpot-plugin`)
  console.log(`  ${chalk.gray('$')} unoff dev`)
  console.log(`  ${chalk.gray('$')} unoff ai`)
  console.log(`  ${chalk.gray('$')} unoff ai status`)
  console.log(`  ${chalk.gray('$')} unoff add worker announcement`)
  console.log(`  ${chalk.gray('$')} unoff add skills`)
  console.log(`  ${chalk.gray('$')} unoff add rules --force`)
  console.log(`  ${chalk.gray('$')} unoff add agents`)
  console.log(`  ${chalk.gray('$')} unoff add specs`)
  console.log(`  ${chalk.gray('$')} unoff specs sync`)
  console.log(`  ${chalk.gray('$')} unoff remove worker cors`)
  console.log(`  ${chalk.gray('$')} unoff remove skills`)
  console.log(`  ${chalk.gray('$')} unoff remove specs`)
  console.log()

  console.log(chalk.bold('MORE'))
  console.log(
    `  ${chalk.gray('Docs & source:')} ${chalk.underline('https://github.com/yelbolt/unoff-cli')}`
  )
  console.log()
}
