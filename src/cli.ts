#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { createPlugin } from './commands/create.js'
import { runScript } from './commands/run.js'
import { addWorker, addSkills, addSpecs } from './commands/add.js'
import { removeWorker, removeSkills, removeSpecs } from './commands/remove.js'
import { showHelp } from './commands/help.js'

const program = new Command()

program
  .name('unoff')
  .description(
    'CLI tool to create plugins for Figma, Penpot, Sketch, and Framer'
  )
  .version('0.2.0')

program
  .command('create <platform>')
  .description('Create a new plugin for a specific platform')
  .action(async (platform: string) => {
    const availablePlatforms = ['figma-plugin', 'penpot-plugin']
    const comingSoonPlatforms = ['sketch-plugin', 'framer-plugin']
    const allPlatforms = [...availablePlatforms, ...comingSoonPlatforms]

    if (!allPlatforms.includes(platform)) {
      console.error(chalk.red(`\n❌ Invalid platform: ${platform}`))
      console.error(
        chalk.yellow(`\nAvailable platforms: ${availablePlatforms.join(', ')}`)
      )
      console.error(
        chalk.gray(`Coming soon: ${comingSoonPlatforms.join(', ')}\n`)
      )
      process.exit(1)
    }

    if (comingSoonPlatforms.includes(platform)) {
      console.error(chalk.yellow(`\n🚧 ${platform} template is coming soon!\n`))
      process.exit(0)
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

const addCmd = program
  .command('add')
  .description('Add a worker, skills submodule, or specs folder')

addCmd
  .command('worker <name>')
  .description('Add a Cloudflare Worker as a git submodule')
  .action(async (name: string) => {
    try {
      await addWorker(name)
    } catch (error) {
      console.error(chalk.red('\n❌ Error adding worker:'), error)
      process.exit(1)
    }
  })

addCmd
  .command('skills')
  .description('Add the unoff-skills repo as a git submodule')
  .action(async () => {
    try {
      await addSkills()
    } catch (error) {
      console.error(chalk.red('\n❌ Error adding skills:'), error)
      process.exit(1)
    }
  })

addCmd
  .command('specs')
  .description('Create a local specs folder with an empty skill template')
  .action(async () => {
    try {
      await addSpecs()
    } catch (error) {
      console.error(chalk.red('\n❌ Error adding specs:'), error)
      process.exit(1)
    }
  })

const removeCmd = program
  .command('remove')
  .description('Remove a worker, skills submodule, or specs folder')

removeCmd
  .command('worker <name>')
  .description('Remove a worker submodule and clean up package.json')
  .action(async (name: string) => {
    try {
      await removeWorker(name)
    } catch (error) {
      console.error(chalk.red('\n❌ Error removing worker:'), error)
      process.exit(1)
    }
  })

removeCmd
  .command('skills')
  .description('Remove the skills submodule')
  .action(async () => {
    try {
      await removeSkills()
    } catch (error) {
      console.error(chalk.red('\n❌ Error removing skills:'), error)
      process.exit(1)
    }
  })

removeCmd
  .command('specs')
  .description('Remove the local specs folder')
  .action(async () => {
    try {
      await removeSpecs()
    } catch (error) {
      console.error(chalk.red('\n❌ Error removing specs:'), error)
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
