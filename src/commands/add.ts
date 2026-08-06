import { execSync, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import {
  SKILL_NAME,
  UnoffConfig,
  resolveConfig,
  skillsDirsFor,
} from './config.js'

export const SKILLS_REPO = 'https://github.com/yelbolt/unoff-skills'
export const SKILLS_PACKAGE = 'yelbolt/unoff-skills'

export const SKILLS_SUBMODULE_PATH = path.join('.unoff', 'skills')
export const SKILLS_PATH = path.join('.claude', 'skills', SKILL_NAME)

export const CLAUDE_MARKETPLACE = 'yelbolt/claude-marketplace'
export const CLAUDE_PLUGIN = 'unoff@yelbolt'

export const WORKERS: Record<string, string> = {
  announcement: 'https://github.com/a-ng-d/announcements-yelbolt-worker',
  auth: 'https://github.com/a-ng-d/auth-yelbolt-worker',
  cors: 'https://github.com/a-ng-d/cors-yelbolt-worker',
}

export const WORKER_SCRIPTS: Record<string, Record<string, string>> = {
  announcement: {
    'start:announcements': 'npm run start:8888 -w announcements-yelbolt-worker',
  },
  auth: {
    'start:token': 'npm run start:8787 -w auth-yelbolt-worker',
  },
  cors: {
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

export function extractSubmodulePath(
  gitmodulesContent: string,
  repoUrl: string
): string | null {
  const blocks = gitmodulesContent.split(/\[submodule\s+/)
  for (const block of blocks) {
    if (!block.includes(repoUrl)) continue
    const pathMatch = block.match(/^\s*path\s*=\s*(.+)$/m)
    if (pathMatch) return pathMatch[1].trim()
  }
  return null
}

export function skillLinkPaths(
  config: Pick<UnoffConfig, 'assistants' | 'skillsPath'>
): string[] {
  return [...new Set([config.skillsPath, ...skillsDirsFor(config.assistants)])]
}

export async function linkSkill(
  cwd: string,
  submodulePath: string,
  linkPath: string
): Promise<'linked' | 'copied' | 'skipped'> {
  const target = path.resolve(cwd, submodulePath, SKILL_NAME)
  const link = path.resolve(cwd, linkPath)

  if (!fs.existsSync(target)) return 'skipped'

  // Only ever replace something we put there ourselves.
  const previous = await fs.lstat(link).catch(() => null)
  if (previous && !previous.isSymbolicLink()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `"${linkPath}" already exists. Replace it with a link to the submodule?`,
        default: false,
      },
    ])
    if (!overwrite) return 'skipped'
  }

  await fs.ensureDir(path.dirname(link))
  if (previous) await fs.remove(link)

  try {
    if (process.platform === 'win32') {
      await fs.symlink(target, link, 'junction')
    } else {
      await fs.symlink(path.relative(path.dirname(link), target), link)
    }
    return 'linked'
  } catch {
    await fs.copy(target, link)
    return 'copied'
  }
}

export async function unlinkSkills(
  cwd: string,
  linkPaths: string[]
): Promise<string[]> {
  const removed: string[] = []

  for (const relative of linkPaths) {
    const link = path.resolve(cwd, relative)
    const stat = await fs.lstat(link).catch(() => null)
    if (!stat?.isSymbolicLink()) continue

    await fs.remove(link)
    removed.push(relative)
  }

  return removed
}

export function isNestedSkillsPath(submodulePath: string): boolean {
  return path.basename(submodulePath) === SKILL_NAME
}

export async function addSkills() {
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
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' })
  } catch {
    console.error(
      chalk.red(
        '\n❌ Not inside a git repository. Run this command from within your plugin project.\n'
      )
    )
    process.exit(1)
  }

  const { config } = await resolveConfig(cwd)
  const gitmodulesPath = path.join(cwd, '.gitmodules')
  const gitmodules = fs.existsSync(gitmodulesPath)
    ? await fs.readFile(gitmodulesPath, 'utf-8')
    : ''
  const existingPath = gitmodules.includes(SKILLS_REPO)
    ? extractSubmodulePath(gitmodules, SKILLS_REPO)
    : null

  if (existingPath) {
    if (!isNestedSkillsPath(existingPath)) {
      console.error(
        chalk.red(
          `\n❌ Skills submodule already exists at "${existingPath}".\n`
        )
      )
      console.error(
        chalk.yellow(
          `Relink it into your skills directories with \`unoff sync skills\`,\n` +
            `or remove it first with \`unoff remove skills\`.\n`
        )
      )
      process.exit(1)
    }

    await repairNestedSkills(cwd, existingPath, config)
    return
  }

  // Ask where to place the submodule
  const { submodulePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'submodulePath',
      message: 'Where do you want to add the skills submodule?',
      default: SKILLS_SUBMODULE_PATH,
    },
  ])

  if (isNestedSkillsPath(submodulePath)) {
    console.error(
      chalk.red(
        `\n❌ "${submodulePath}" would nest the repo one level too deep.\n`
      )
    )
    console.error(
      chalk.yellow(
        `The submodule clones the whole unoff-skills repo, which already holds a\n` +
          `${SKILL_NAME}/ folder — SKILL.md would end up at\n` +
          `${path.join(submodulePath, SKILL_NAME, 'SKILL.md')}, where no assistant looks.\n\n` +
          `Pick a path outside your skills directories (default: ${SKILLS_SUBMODULE_PATH}).\n`
      )
    )
    process.exit(1)
  }

  const resolvedPath = path.resolve(cwd, submodulePath)

  if (gitmodules.includes(`path = ${submodulePath}`)) {
    console.error(
      chalk.red(
        `\n❌ A submodule is already registered at "${submodulePath}".\n`
      )
    )
    process.exit(1)
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

  const spinner = ora('Adding skills submodule...').start()

  const result = spawnSync(
    'git',
    ['submodule', 'add', SKILLS_REPO, submodulePath],
    { cwd, encoding: 'utf-8' }
  )

  if (result.status !== 0) {
    spinner.fail(chalk.red('Failed to add submodule'))
    console.error(chalk.red(`\n${result.stderr}\n`))
    process.exit(1)
  }

  spinner.succeed(
    chalk.green(`Skills submodule added at ${chalk.white(submodulePath)}`)
  )

  await reportLinks(cwd, submodulePath, config)

  console.log(chalk.cyan('\n📦 Next steps:\n'))
  console.log(chalk.white(`  git submodule update --init --recursive`))

  console.log(
    chalk.gray(
      `\n  Alternative — copy the skills instead of tracking a submodule:\n` +
        `    npx skills add ${SKILLS_PACKAGE}\n` +
        `  Or get them bundled with the agents, via the Claude Code plugin:\n` +
        `    /plugin marketplace add ${CLAUDE_MARKETPLACE}\n` +
        `    /plugin install ${CLAUDE_PLUGIN}`
    )
  )

  console.log(chalk.cyan('\n✨ Happy coding!\n'))
}

async function repairNestedSkills(
  cwd: string,
  currentPath: string,
  config: UnoffConfig
) {
  console.log(
    chalk.yellow(
      `\n⚠️  The skills submodule sits at "${currentPath}", inside a skills directory.\n` +
        `   That buries SKILL.md at ${path.join(currentPath, SKILL_NAME, 'SKILL.md')},\n` +
        `   one level deeper than Claude or Codex look — so the skill never loads.\n`
    )
  )

  const { destination } = await inquirer.prompt([
    {
      type: 'input',
      name: 'destination',
      message: 'Move the submodule to:',
      default: SKILLS_SUBMODULE_PATH,
    },
  ])

  if (isNestedSkillsPath(destination)) {
    console.error(
      chalk.red(
        `\n❌ "${destination}" has the same problem. Pick another path.\n`
      )
    )
    process.exit(1)
  }

  const spinner = ora('Moving skills submodule...').start()

  await fs.ensureDir(path.resolve(cwd, path.dirname(destination)))
  const moved = spawnSync('git', ['mv', currentPath, destination], {
    cwd,
    encoding: 'utf-8',
  })

  if (moved.status !== 0) {
    spinner.fail(chalk.red('Failed to move the submodule'))
    console.error(chalk.red(`\n${moved.stderr}\n`))
    console.error(
      chalk.yellow(
        `Remove it with \`unoff remove skills\`, then run \`unoff add skills\` again.\n`
      )
    )
    process.exit(1)
  }

  spinner.succeed(
    chalk.green(
      `Skills submodule moved to ${chalk.white(destination)} — one level up`
    )
  )

  await reportLinks(cwd, destination, config)
  console.log(chalk.cyan('\n✨ Your assistants can load the skill now.\n'))
}

async function reportLinks(
  cwd: string,
  submodulePath: string,
  config: UnoffConfig
) {
  const links = skillLinkPaths(config)
  if (!links.length) return

  console.log()
  for (const relative of links) {
    const outcome = await linkSkill(cwd, submodulePath, relative)
    const label =
      outcome === 'linked'
        ? chalk.green('linked')
        : outcome === 'copied'
          ? chalk.cyan('copied')
          : chalk.gray('skipped')
    console.log(`  ${label.padEnd(18)}${chalk.gray(relative + '/')}`)
  }

  console.log(
    chalk.gray(
      `\n  Each one points at ${path.join(submodulePath, SKILL_NAME)}/, so SKILL.md\n` +
        `  lands exactly where every assistant looks for it.`
    )
  )
}

export async function syncSkills() {
  const cwd = process.cwd()
  const { config } = await resolveConfig(cwd)

  const gitmodulesPath = path.join(cwd, '.gitmodules')
  const gitmodules = fs.existsSync(gitmodulesPath)
    ? await fs.readFile(gitmodulesPath, 'utf-8')
    : ''
  const submodulePath = extractSubmodulePath(gitmodules, SKILLS_REPO)

  if (!submodulePath) {
    console.error(
      chalk.red(`\n❌ No skills submodule registered in .gitmodules.\n`)
    )
    console.error(chalk.yellow(`Add one with \`unoff add skills\`.\n`))
    process.exit(1)
  }

  if (isNestedSkillsPath(submodulePath)) {
    await repairNestedSkills(cwd, submodulePath, config)
    return
  }

  if (!fs.existsSync(path.resolve(cwd, submodulePath, SKILL_NAME))) {
    console.error(
      chalk.red(
        `\n❌ "${submodulePath}" is empty — the submodule is not cloned.\n`
      )
    )
    console.error(
      chalk.yellow(`Run \`git submodule update --init --recursive\` first.\n`)
    )
    process.exit(1)
  }

  await reportLinks(cwd, submodulePath, config)
  console.log(chalk.cyan('\n✨ Skills are linked.\n'))
}

export { addSpecs, toTitleCase } from './specs.js'
