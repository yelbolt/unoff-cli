import chalk from 'chalk'
import { WORKERS, WORKER_SCRIPTS } from './add.js'

const PLATFORMS = ['figma-plugin', 'penpot-plugin', 'sketch-plugin', 'framer-plugin']

const SERVICES = [
  { name: 'supabase', label: 'Supabase   (Database & Authentication)' },
  { name: 'mixpanel', label: 'Mixpanel   (Analytics)' },
  { name: 'sentry',   label: 'Sentry     (Error Monitoring)' },
  { name: 'notion',   label: 'Notion     (Announcements & Onboarding)' },
]

function row(cmd: string, desc: string) {
  return `  ${chalk.cyan(cmd.padEnd(36))}${chalk.white(desc)}`
}

function workerRow(name: string) {
  const scripts = Object.keys(WORKER_SCRIPTS[name] ?? {})
  const scriptLabel = scripts.length ? chalk.gray(`→ adds: ${scripts.join(', ')}`) : ''
  return `  ${chalk.yellow(('  ' + name).padEnd(36))}${scriptLabel}`
}

export function showHelp() {
  console.log()
  console.log(chalk.bold.white('  unoff') + chalk.gray(' — Unofficial Plugin CLI'))
  console.log()

  console.log(chalk.bold('USAGE'))
  console.log(`  ${chalk.cyan('unoff')} ${chalk.white('<command>')} ${chalk.gray('[options]')}`)
  console.log()

  console.log(chalk.bold('COMMANDS'))
  console.log()

  console.log(chalk.dim('  — Project'))
  console.log(
    row(
      `create <platform>`,
      'Scaffold a new plugin project'
    )
  )
  console.log(chalk.gray(`  ${''.padEnd(36)}Platforms: ${PLATFORMS.join(', ')}`))
  console.log(chalk.gray(`  ${''.padEnd(36)}Services (toggleable, all enabled by default):`))
  for (const s of SERVICES) {
    console.log(chalk.gray(`  ${''.padEnd(38)}· ${s.label}`))
  }
  console.log()

  console.log(chalk.dim('  — Development'))
  console.log(row('dev', 'Start development mode  (npm run start:dev)'))
  console.log(row('build', 'Build for production    (npm run build:prod)'))
  console.log(row('check', 'Lint + typecheck        (npm run lint && typecheck)'))
  console.log(row('format', 'Format source code      (npm run format)'))
  console.log()

  console.log(chalk.dim('  — Workers'))
  console.log(row('add <worker>', 'Add a worker as a git submodule'))
  console.log(row('remove <worker>', 'Remove a worker submodule'))
  console.log()
  console.log(chalk.gray('  Available workers:'))
  for (const name of Object.keys(WORKERS)) {
    console.log(workerRow(name))
  }
  console.log()

  console.log(chalk.bold('EXAMPLES'))
  console.log()
  console.log(`  ${chalk.gray('$')} unoff create figma-plugin`)
  console.log(`  ${chalk.gray('$')} unoff dev`)
  console.log(`  ${chalk.gray('$')} unoff add announcement-worker`)
  console.log(`  ${chalk.gray('$')} unoff remove cors-worker`)
  console.log()

  console.log(chalk.bold('MORE'))
  console.log(
    `  ${chalk.gray('Docs & source:')} ${chalk.underline('https://github.com/yelbolt/unoff-cli')}`
  )
  console.log()
}
