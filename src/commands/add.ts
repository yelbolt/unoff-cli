import { execSync, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'

export const WORKERS: Record<string, string> = {
  'announcement-worker':
    'https://github.com/a-ng-d/announcements-yelbolt-worker',
  'auth-worker': 'https://github.com/a-ng-d/auth-yelbolt-worker',
  'cors-worker': 'https://github.com/a-ng-d/cors-yelbolt-worker',
}

export const WORKER_SCRIPTS: Record<string, Record<string, string>> = {
  'announcement-worker': {
    'start:announcements': 'npm run start:8888 -w announcements-yelbolt-worker',
  },
  'auth-worker': {
    'start:token': 'npm run start:8787 -w auth-yelbolt-worker',
  },
  'cors-worker': {
    'start:cors': 'npm run start:8989 -w cors-yelbolt-worker',
  },
}

const VALID_WORKERS = Object.keys(WORKERS)

export async function addWorker(workerName: string) {
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

  const repoUrl = WORKERS[workerName]

  // Check if git is available
  const gitCheck = spawnSync('git', ['--version'], { encoding: 'utf-8' })
  if (gitCheck.status !== 0) {
    console.error(chalk.red('\n❌ git is not available. Please install git.\n'))
    process.exit(1)
  }

  // Check if we're inside a git repository
  let cwd: string
  try {
    cwd = process.cwd()
    execSync('git rev-parse --is-inside-work-tree', {
      cwd,
      stdio: 'ignore',
    })
  } catch {
    console.error(
      chalk.red(
        '\n❌ Not inside a git repository. Run this command from within your plugin project.\n'
      )
    )
    process.exit(1)
  }

  // Ask where to place the submodule
  const { submodulePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'submodulePath',
      message: `Where do you want to add the submodule?`,
      default: path.join('workers', workerName),
    },
  ])

  const resolvedPath = path.resolve(cwd, submodulePath)

  // Check if submodule already exists in .gitmodules
  const gitmodulesPath = path.join(cwd, '.gitmodules')
  if (fs.existsSync(gitmodulesPath)) {
    const gitmodulesContent = await fs.readFile(gitmodulesPath, 'utf-8')
    if (
      gitmodulesContent.includes(repoUrl) ||
      gitmodulesContent.includes(submodulePath)
    ) {
      console.error(
        chalk.red(
          `\n❌ Submodule already exists at "${submodulePath}" or with the same URL.\n`
        )
      )
      process.exit(1)
    }
  }

  // Check if directory already exists and is not empty
  if (fs.existsSync(resolvedPath) && fs.readdirSync(resolvedPath).length > 0) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory "${submodulePath}" already exists and is not empty. Continue anyway?`,
        default: false,
      },
    ])

    if (!overwrite) {
      console.log(chalk.yellow('\n✋ Operation cancelled\n'))
      process.exit(0)
    }
  }

  const spinner = ora(`Adding submodule ${chalk.cyan(workerName)}...`).start()

  const result = spawnSync(
    'git',
    ['submodule', 'add', repoUrl, submodulePath],
    { cwd, encoding: 'utf-8' }
  )

  if (result.status !== 0) {
    spinner.fail(chalk.red('Failed to add submodule'))
    console.error(chalk.red(`\n${result.stderr}\n`))
    process.exit(1)
  }

  spinner.succeed(
    chalk.green(
      `Submodule ${chalk.cyan(workerName)} added at ${chalk.white(submodulePath)}`
    )
  )

  // Update package.json: workspaces + scripts
  const packageJsonPath = path.join(cwd, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath)

    // Workspaces
    const workspaces: string[] = packageJson.workspaces ?? []
    if (!workspaces.includes(submodulePath)) {
      packageJson.workspaces = [...workspaces, submodulePath]
    }

    // Scripts
    const scripts: Record<string, string> = packageJson.scripts ?? {}
    const workerScripts = WORKER_SCRIPTS[workerName] ?? {}
    let addedScripts = false
    for (const [key, value] of Object.entries(workerScripts)) {
      if (!scripts[key]) {
        scripts[key] = value
        addedScripts = true
      }
    }
    packageJson.scripts = scripts

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
    console.log(
      chalk.green(
        `\n✅ Added ${chalk.white(submodulePath)} to ${chalk.white('package.json')} workspaces`
      )
    )
    if (addedScripts) {
      const scriptKeys = Object.keys(workerScripts).join(', ')
      console.log(
        chalk.green(
          `✅ Added script(s) ${chalk.white(scriptKeys)} to ${chalk.white('package.json')}`
        )
      )
    }
  }

  console.log(chalk.cyan('\n📦 Next steps:\n'))
  console.log(chalk.white(`  npm install`))
  console.log(chalk.white(`  npm run start:<worker>`))
  console.log(chalk.cyan('\n✨ Happy coding!\n'))
}
