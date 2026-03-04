import { spawn } from 'child_process'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'

export async function runScript(scriptName: string) {
  const cwd = process.cwd()
  const packageJsonPath = path.join(cwd, 'package.json')

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    console.error(
      chalk.red(
        '\n❌ No package.json found. Are you in an Unoff plugin directory?\n'
      )
    )
    process.exit(1)
  }

  // Read package.json
  const packageJson = await fs.readJson(packageJsonPath)

  // Check if it's an Unoff plugin
  if (!packageJson.keywords || !packageJson.keywords.includes('unoff-plugin')) {
    console.error(
      chalk.red(
        "\n❌ This doesn't appear to be an Unoff plugin. Make sure you're in the right directory.\n"
      )
    )
    process.exit(1)
  }

  // Check if the script exists
  if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
    console.error(
      chalk.red(`\n❌ Script "${scriptName}" not found in package.json\n`)
    )
    console.log(chalk.yellow('Available scripts:'))
    if (packageJson.scripts) {
      Object.keys(packageJson.scripts).forEach((script) => {
        console.log(chalk.white(`  - ${script}`))
      })
    }
    process.exit(1)
  }

  console.log(
    chalk.cyan(`\n🚀 Running: ${chalk.white(`npm run ${scriptName}`)}\n`)
  )

  return new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', scriptName], {
      cwd,
      stdio: 'inherit',
      shell: true,
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code !== 0)
        reject(new Error(`Script "${scriptName}" exited with code ${code}`))
      else resolve()
    })
  })
}
