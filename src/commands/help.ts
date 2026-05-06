import chalk from 'chalk'
import { WORKERS, WORKER_SCRIPTS, SKILLS_REPO } from './add.js'

const AVAILABLE_PLATFORMS = ['figma-plugin']
const COMING_SOON_PLATFORMS = [
  'penpot-plugin',
  'sketch-plugin',
  'framer-plugin',
]

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
  console.log(row(`create <platform>`, 'Scaffold a new plugin project'))
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
    row('add specs', 'Create a local specs folder with an empty skill template')
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

  console.log(chalk.bold('EXAMPLES'))
  console.log()
  console.log(`  ${chalk.gray('$')} unoff create figma-plugin`)
  console.log(`  ${chalk.gray('$')} unoff dev`)
  console.log(`  ${chalk.gray('$')} unoff add worker announcement`)
  console.log(`  ${chalk.gray('$')} unoff add skills`)
  console.log(`  ${chalk.gray('$')} unoff add specs`)
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
