import { execSync, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { WORKERS, WORKER_SCRIPTS, SKILLS_REPO } from './add.js'

const VALID_WORKERS = Object.keys(WORKERS)

export async function removeWorker(workerName: string) {
  // Validate worker name
  if (!VALID_WORKERS.includes(workerName)) {
    console.error(chalk.red(`\n❌ Unknown worker: ${workerName}`))
    console.error(
      chalk.yellow(
        `\nAvailable workers:\n${VALID_WORKERS.map((w) => `  - ${w}`).join('\n')}\n`
      )
    )
    process.exit(1)
  }

  // Check if we're inside a git repository
  let cwd: string
  try {
    cwd = process.cwd()
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' })
  } catch {
    console.error(
      chalk.red(
        '\n❌ Not inside a git repository. Run this command from within your plugin project.\n'
      )
    )
    process.exit(1)
  }

  // Find the submodule path from .gitmodules
  const repoUrl = WORKERS[workerName]
  const gitmodulesPath = path.join(cwd, '.gitmodules')

  if (!fs.existsSync(gitmodulesPath)) {
    console.error(
      chalk.red(`\n❌ No .gitmodules found. Have you added any workers?\n`)
    )
    process.exit(1)
  }

  const gitmodulesContent = await fs.readFile(gitmodulesPath, 'utf-8')
  if (!gitmodulesContent.includes(repoUrl)) {
    console.error(
      chalk.red(`\n❌ Worker "${workerName}" is not registered as a submodule.\n`)
    )
    process.exit(1)
  }

  // Extract path from .gitmodules for this URL
  const submodulePath = extractSubmodulePath(gitmodulesContent, repoUrl)
  if (!submodulePath) {
    console.error(
      chalk.red(`\n❌ Could not determine submodule path for "${workerName}".\n`)
    )
    process.exit(1)
  }

  // Confirm removal
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove worker ${chalk.cyan(workerName)} at ${chalk.white(submodulePath)}? This cannot be undone.`,
      default: false,
    },
  ])

  if (!confirm) {
    console.log(chalk.yellow('\n✋ Operation cancelled\n'))
    process.exit(0)
  }

  const spinner = ora(`Removing submodule ${chalk.cyan(workerName)}...`).start()

  // Deinit and remove the submodule
  spawnSync('git', ['submodule', 'deinit', '-f', submodulePath], {
    cwd,
    encoding: 'utf-8',
  })

  const rmResult = spawnSync('git', ['rm', '-f', submodulePath], {
    cwd,
    encoding: 'utf-8',
  })

  if (rmResult.status !== 0) {
    spinner.fail(chalk.red('Failed to remove submodule'))
    console.error(chalk.red(`\n${rmResult.stderr}\n`))
    process.exit(1)
  }

  // Remove .git/modules/<path> leftovers
  const gitModulesDir = path.join(cwd, '.git', 'modules', submodulePath)
  if (fs.existsSync(gitModulesDir)) {
    await fs.remove(gitModulesDir)
  }

  spinner.succeed(
    chalk.green(`Submodule ${chalk.cyan(workerName)} removed from ${chalk.white(submodulePath)}`)
  )

  // Update package.json: workspaces + scripts
  const packageJsonPath = path.join(cwd, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath)

    // Workspaces
    if (Array.isArray(packageJson.workspaces)) {
      packageJson.workspaces = packageJson.workspaces.filter(
        (w: string) => w !== submodulePath
      )
    }

    // Scripts
    const workerScripts = WORKER_SCRIPTS[workerName] ?? {}
    let removedScripts = false
    if (packageJson.scripts) {
      for (const key of Object.keys(workerScripts)) {
        if (packageJson.scripts[key] !== undefined) {
          delete packageJson.scripts[key]
          removedScripts = true
        }
      }
    }

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
    console.log(
      chalk.green(
        `\n✅ Removed ${chalk.white(submodulePath)} from ${chalk.white('package.json')} workspaces`
      )
    )
    if (removedScripts) {
      const scriptKeys = Object.keys(workerScripts).join(', ')
      console.log(
        chalk.green(
          `✅ Removed script(s) ${chalk.white(scriptKeys)} from ${chalk.white('package.json')}`
        )
      )
    }
  }

  console.log(chalk.cyan('\n✨ Done!\n'))
}

function extractSubmodulePath(gitmodulesContent: string, repoUrl: string): string | null {
  // Parse .gitmodules to find the path for a given URL
  const blocks = gitmodulesContent.split(/\[submodule\s+/)
  for (const block of blocks) {
    if (!block.includes(repoUrl)) continue
    const pathMatch = block.match(/^\s*path\s*=\s*(.+)$/m)
    if (pathMatch) return pathMatch[1].trim()
  }
  return null
}

export async function removeSkills() {
  // Check if we're inside a git repository
  let cwd: string
  try {
    cwd = process.cwd()
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' })
  } catch {
    console.error(
      chalk.red(
        '\n❌ Not inside a git repository. Run this command from within your plugin project.\n'
      )
    )
    process.exit(1)
  }

  const gitmodulesPath = path.join(cwd, '.gitmodules')

  if (!fs.existsSync(gitmodulesPath)) {
    console.error(
      chalk.red(`\n❌ No .gitmodules found. Have you added a skills submodule?\n`)
    )
    process.exit(1)
  }

  const gitmodulesContent = await fs.readFile(gitmodulesPath, 'utf-8')
  if (!gitmodulesContent.includes(SKILLS_REPO)) {
    console.error(
      chalk.red(`\n❌ Skills submodule is not registered in .gitmodules.\n`)
    )
    process.exit(1)
  }

  const submodulePath = extractSubmodulePath(gitmodulesContent, SKILLS_REPO)
  if (!submodulePath) {
    console.error(
      chalk.red(`\n❌ Could not determine submodule path for skills.\n`)
    )
    process.exit(1)
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove skills submodule at ${chalk.white(submodulePath)}? This cannot be undone.`,
      default: false,
    },
  ])

  if (!confirm) {
    console.log(chalk.yellow('\n✋ Operation cancelled\n'))
    process.exit(0)
  }

  const spinner = ora('Removing skills submodule...').start()

  spawnSync('git', ['submodule', 'deinit', '-f', submodulePath], {
    cwd,
    encoding: 'utf-8',
  })

  const rmResult = spawnSync('git', ['rm', '-f', submodulePath], {
    cwd,
    encoding: 'utf-8',
  })

  if (rmResult.status !== 0) {
    spinner.fail(chalk.red('Failed to remove skills submodule'))
    console.error(chalk.red(`\n${rmResult.stderr}\n`))
    process.exit(1)
  }

  const gitModulesDir = path.join(cwd, '.git', 'modules', submodulePath)
  if (fs.existsSync(gitModulesDir)) {
    await fs.remove(gitModulesDir)
  }

  spinner.succeed(
    chalk.green(`Skills submodule removed from ${chalk.white(submodulePath)}`)
  )

  console.log(chalk.cyan('\n✨ Done!\n'))
}

export async function removeSpecs() {
  const cwd = process.cwd()

  const { specsDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'specsDir',
      message: 'Path to the specs folder to remove:',
      default: 'specs',
    },
  ])

  const specsPath = path.resolve(cwd, specsDir)

  if (!fs.existsSync(specsPath)) {
    console.error(
      chalk.red(`\n❌ Folder "${specsDir}" does not exist.\n`)
    )
    process.exit(1)
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove specs folder ${chalk.white(specsDir)} and all its contents? This cannot be undone.`,
      default: false,
    },
  ])

  if (!confirm) {
    console.log(chalk.yellow('\n✋ Operation cancelled\n'))
    process.exit(0)
  }

  const spinner = ora('Removing specs folder...').start()

  await fs.remove(specsPath)

  spinner.succeed(
    chalk.green(`Specs folder ${chalk.white(specsDir)} removed`)
  )

  console.log(chalk.cyan('\n✨ Done!\n'))
}
