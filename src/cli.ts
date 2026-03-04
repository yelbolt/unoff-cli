#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { createPlugin } from './commands/create.js'
import { runScript } from './commands/run.js'
import { addWorker } from './commands/add.js'
import { removeWorker } from './commands/remove.js'
import { showHelp } from './commands/help.js'

const program = new Command()

program
  .name('unoff')
  .description(
    'CLI tool to create plugins for Figma, Penpot, Sketch, and Framer'
  )
  .version('0.1.0')

program
  .command('create <platform>')
  .description('Create a new plugin for a specific platform')
  .action(async (platform: string) => {
    const validPlatforms = [
      'figma-plugin',
      'penpot-plugin',
      'sketch-plugin',
      'framer-plugin',
    ]

    if (!validPlatforms.includes(platform)) {
      console.error(chalk.red(`\n❌ Invalid platform: ${platform}`))
      console.error(
        chalk.yellow(`\nValid platforms: ${validPlatforms.join(', ')}\n`)
      )
      process.exit(1)
    }

    try {
      await createPlugin(platform)
    } catch (error) {
      console.error(chalk.red('\n❌ Error creating plugin:'), error)
      process.exit(1)
    }
  })

program
  .command('dev')
  .description('Start development mode (runs npm run start:dev)')
  .action(async () => {
    try {
      await runScript('start:dev')
    } catch (error) {
      console.error(chalk.red('\n❌ Error running dev script:'), error)
      process.exit(1)
    }
  })

program
  .command('build')
  .description('Build for production (runs npm run build:prod)')
  .action(async () => {
    try {
      await runScript('build:prod')
    } catch (error) {
      console.error(chalk.red('\n❌ Error running build script:'), error)
      process.exit(1)
    }
  })

program
  .command('check')
  .description('Run lint and type checking (npm run lint + npm run typecheck)')
  .action(async () => {
    try {
      await runScript('lint')
      await runScript('typecheck')
    } catch (error) {
      console.error(chalk.red('\n❌ Check failed:'), error)
      process.exit(1)
    }
  })

program
  .command('format')
  .description('Format source code (runs npm run format)')
  .action(async () => {
    try {
      await runScript('format')
    } catch (error) {
      console.error(chalk.red('\n❌ Error running format:'), error)
      process.exit(1)
    }
  })

program
  .command('add <worker>')
  .description('Add a worker as a git submodule')
  .action(async (worker: string) => {
    try {
      await addWorker(worker)
    } catch (error) {
      console.error(chalk.red('\n❌ Error adding worker:'), error)
      process.exit(1)
    }
  })

program
  .command('remove <worker>')
  .description('Remove a worker submodule and clean up package.json')
  .action(async (worker: string) => {
    try {
      await removeWorker(worker)
    } catch (error) {
      console.error(chalk.red('\n❌ Error removing worker:'), error)
      process.exit(1)
    }
  })

program
  .command('help')
  .description('Show detailed help and available commands')
  .action(() => {
    showHelp()
  })

program.parse(process.argv)

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  showHelp()
}
