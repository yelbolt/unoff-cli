import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import Mustache from 'mustache'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface TemplateData {
  pluginName: string
  pluginSlug: string
  pluginId: string
  githubUsername: string
  authorName: string
  licenseName: string
  currentYear: string
  isSupabaseEnabled: boolean
  isMixpanelEnabled: boolean
  isSentryEnabled: boolean
  isNotionEnabled: boolean
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generatePluginId(): string {
  // Generate a unique 19-digit ID
  // Format: timestamp (13 digits) + random (6 digits) = 19 digits total
  const timestamp = Date.now().toString() // 13 digits
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0') // 6 digits
  return timestamp + random
}

export async function createPlugin(platform: string) {
  console.log(chalk.cyan('\n🚀 Unoff Plugin Creator\n'))

  // Always ask for plugin name
  const nameAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What is your plugin name?',
      default: 'My Awesome Plugin',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Plugin name is required'
        }
        return true
      },
    },
  ])
  const pluginName = nameAnswer.name as string

  // Ask for output directory
  const dirAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'directory',
      message: 'Where do you want to create your plugin?',
      default: '.',
    },
  ])

  // Ask for GitHub username
  const githubAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'What is your GitHub username?',
      default: 'octocat',
    },
  ])

  // Ask for author name
  const authorAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'author',
      message: 'What is your name (author)?',
      default: 'John Doe',
    },
  ])

  // Ask for license
  const licenseAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'license',
      message: 'Choose a license:',
      default: 'MIT',
      choices: [
        'MIT',
        'Apache-2.0',
        'GPL-3.0',
        'BSD-3-Clause',
        'ISC',
        'MPL-2.0',
        'LGPL-3.0',
        'AGPL-3.0',
        'Unlicense',
        'BSD-2-Clause',
      ],
    },
  ])

  // Ask for external services
  const servicesAnswers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'services',
      message: 'Which external services do you want to enable?',
      choices: [
        {
          name: 'Supabase (Database & Authentication)',
          value: 'supabase',
          checked: true,
        },
        {
          name: 'Mixpanel (Analytics)',
          value: 'mixpanel',
          checked: true,
        },
        {
          name: 'Sentry (Error Monitoring)',
          value: 'sentry',
          checked: true,
        },
        {
          name: 'Notion (Announcements & Onboarding)',
          value: 'notion',
          checked: true,
        },
      ],
    },
  ])

  const pluginSlug = slugify(pluginName)
  const platformName = platform.replace('-plugin', '')
  const templateDir = path.join(
    __dirname,
    '..',
    '..',
    'templates',
    platformName
  )

  // Get current working directory with error handling
  let currentDir: string
  try {
    currentDir = process.cwd()
  } catch (error) {
    console.error(
      chalk.red(
        "\n❌ Cannot access current directory. It may have been deleted or you don't have permissions.\n"
      )
    )
    console.log(
      chalk.yellow('💡 Tip: Navigate to a valid directory and try again.\n')
    )
    process.exit(1)
  }

  // Resolve output directory path
  const outputDir = path.resolve(currentDir, dirAnswer.directory, pluginSlug)

  // Check if template exists
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template for ${platformName} not found`)
  }

  // Check if output directory already exists
  if (fs.existsSync(outputDir)) {
    const overwrite = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory "${pluginSlug}" already exists. Overwrite?`,
        default: false,
      },
    ])

    if (!overwrite.overwrite) {
      console.log(chalk.yellow('\n✋ Operation cancelled\n'))
      process.exit(0)
    }

    await fs.remove(outputDir)
  }

  const spinner = ora('Creating plugin...').start()

  try {
    // Template data for Mustache
    const selectedServices = servicesAnswers.services as string[]
    const templateData: TemplateData = {
      pluginName,
      pluginSlug,
      pluginId: generatePluginId(),
      githubUsername: githubAnswers.username,
      authorName: authorAnswers.author as string,
      licenseName: licenseAnswers.license as string,
      currentYear: new Date().getFullYear().toString(),
      isSupabaseEnabled: selectedServices.includes('supabase'),
      isMixpanelEnabled: selectedServices.includes('mixpanel'),
      isSentryEnabled: selectedServices.includes('sentry'),
      isNotionEnabled: selectedServices.includes('notion'),
    }

    // Copy template directory excluding node_modules and dist
    await fs.copy(templateDir, outputDir, {
      filter: (src: string) => {
        const relativePath = path.relative(templateDir, src)
        const parts = relativePath.split(path.sep)

        // Exclude node_modules and dist directories
        return !parts.includes('node_modules') && !parts.includes('dist')
      },
    })

    // Process all files with Mustache templating
    await processDirectory(outputDir, templateData)

    // Remove empty or near-empty files created by conditional Mustache templates
    await removeEmptyFiles(outputDir)

    // Generate .env files based on selected services
    await generateEnvFiles(outputDir, templateData)

    // Post-process global.config.ts to apply Mustache templating and update service flags
    const globalConfigPath = path.join(outputDir, 'src', 'global.config.ts')
    if (await fs.pathExists(globalConfigPath)) {
      let configContent = await fs.readFile(globalConfigPath, 'utf-8')
      // Apply Mustache templating to replace {{ }} placeholders
      configContent = Mustache.render(configContent, templateData)
      // Update service flags
      configContent = configContent
        .replace(
          /isSupabaseEnabled: true/,
          `isSupabaseEnabled: ${templateData.isSupabaseEnabled}`
        )
        .replace(
          /isMixpanelEnabled: true/,
          `isMixpanelEnabled: ${templateData.isMixpanelEnabled}`
        )
        .replace(
          /isSentryEnabled: true/,
          `isSentryEnabled: ${templateData.isSentryEnabled}`
        )
        .replace(
          /isNotionEnabled: true/,
          `isNotionEnabled: ${templateData.isNotionEnabled}`
        )
      await fs.writeFile(globalConfigPath, configContent, 'utf-8')
    }

    // Initialize git repository
    const gitCheck = spawnSync('git', ['--version'], { encoding: 'utf-8' })
    if (gitCheck.status === 0) {
      const gitInit = spawnSync('git', ['init'], {
        cwd: outputDir,
        encoding: 'utf-8',
      })
      if (gitInit.status === 0) {
        spinner.succeed(chalk.green('Plugin created successfully! Git repository initialized.'))
      } else {
        spinner.succeed(chalk.green('Plugin created successfully!'))
        console.warn(chalk.yellow('⚠️  Could not initialize git repository. Run `git init` manually.'))
      }
    } else {
      spinner.succeed(chalk.green('Plugin created successfully!'))
      console.warn(chalk.yellow('⚠️  git is not available. Run `git init` manually before using `unoff add`.'))
    }

    console.log(chalk.cyan('\n📦 Next steps:\n'))
    console.log(chalk.white(`  cd ${pluginSlug}`))
    console.log(chalk.white(`  npm install`))
    console.log(chalk.white(`  unoff build`))
    console.log(chalk.cyan('\n✨ Happy coding!\n'))
  } catch (error) {
    spinner.fail(chalk.red('Failed to create plugin'))
    throw error
  }
}

async function processDirectory(dir: string, templateData: TemplateData) {
  const files = await fs.readdir(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stats = await fs.stat(filePath)

    if (stats.isDirectory()) {
      // Skip node_modules and dist directories
      if (file === 'node_modules' || file === 'dist') {
        continue
      }
      await processDirectory(filePath, templateData)
    } else {
      // Process files that should be templated
      const shouldTemplate = shouldProcessFile(filePath)

      if (shouldTemplate) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const processed = Mustache.render(content, templateData)
          await fs.writeFile(filePath, processed, 'utf-8')
        } catch (error) {
          // Skip binary files or files that can't be read as text
          console.warn(chalk.yellow(`⚠️  Skipped processing: ${file}`))
        }
      }
    }
  }
}

function shouldProcessFile(filePath: string): boolean {
  const ext = path.extname(filePath)
  const fileName = path.basename(filePath)

  // Exclude specific files that can't handle Mustache syntax
  const excludedFiles = ['global.config.ts']
  if (excludedFiles.includes(fileName)) {
    return false
  }

  // List of extensions that should be templated
  // Exclude .tsx and .jsx because they contain {{ }} for JSX objects
  const templateExtensions = [
    '.ts',
    '.js',
    '.json',
    '.md',
    '.html',
    '.css',
    '.yml',
    '.yaml',
    '.txt',
    '.xml',
  ]

  // List of files that should be templated
  const templateFiles = [
    'manifest.json',
    'package.json',
    'README.md',
    'LICENSE',
  ]

  return templateExtensions.includes(ext) || templateFiles.includes(fileName)
}

async function removeEmptyFiles(dir: string) {
  const files = await fs.readdir(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stats = await fs.stat(filePath)

    if (stats.isDirectory()) {
      if (file === 'node_modules' || file === 'dist') {
        continue
      }
      await removeEmptyFiles(filePath)
    } else {
      // Check if file is empty or contains only whitespace
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        if (content.trim().length === 0) {
          await fs.remove(filePath)
        }
      } catch (error) {
        // Skip binary files
      }
    }
  }
}

async function generateEnvFiles(outputDir: string, templateData: TemplateData) {
  const envLocalPath = path.join(outputDir, '.env.local')
  const envSentryPath = path.join(outputDir, '.env.sentry-build-plugin')

  // Generate .env.local content
  const envLocalContent = `
# Supabase Configuration
# Get your keys from: https://supabase.com/dashboard/project/_/settings/api
VITE_SUPABASE_URL='YOUR_SUPABASE_URL'
VITE_SUPABASE_PUBLIC_ANON_KEY='YOUR_SUPABASE_ANON_KEY'

# Sentry Configuration
# Get your DSN from: https://sentry.io/settings/projects/
VITE_SENTRY_DSN='YOUR_SENTRY_DSN'

# Mixpanel Configuration
# Get your token from: https://mixpanel.com/settings/project/
VITE_MIXPANEL_TOKEN='YOUR_MIXPANEL_TOKEN'

# Authentication & Workers
VITE_AUTH_URL='https://auth.${templateData.pluginSlug}.com'

# Workers URLs
VITE_AUTH_WORKER_URL='https://oauth.yelbolt.workers.dev'
VITE_CORS_WORKER_URL='https://cors.yelbolt.workers.dev'
VITE_ANNOUNCEMENTS_WORKER_URL='https://68e83449-announcements.yelbolt.workers.dev/'

# Notion — Content Management (Announcements & Onboarding)
# Duplicate the databases to your Notion workspace and paste their IDs below
# Create an internal integration at https://www.notion.so/my-integrations and add it to both databases
VITE_NOTION_ANNOUNCEMENTS_ID='YOUR_ANNOUNCEMENTS_DB_ID'
VITE_NOTION_ONBOARDING_ID='YOUR_ONBOARDING_DB_ID'
VITE_NOTION_API_KEY='YOUR_NOTION_API_KEY'

# LemonSqueezy (if using payments)
# You can test with this test license key: 0DE7C002-1F28-49E8-A444-B424F346416E
VITE_LEMONSQUEEZY_URL='https://api.lemonsqueezy.com/v1'

# Tolgee Translation (optional)
# Generate your auth token from: https://app.tolgee.io/account/apiKeys
VITE_TOLGEE_URL='YOUR_TOLGEE_URL'
VITE_TOLGEE_API_KEY='YOUR_TOLGEE_API_KEY'
`

  await fs.writeFile(envLocalPath, envLocalContent, 'utf-8')

  // Generate .env.sentry-build-plugin
  const envSentryContent = `# Sentry Build Plugin Configuration
# Generate your auth token from: https://sentry.io/settings/account/api/auth-tokens/
SENTRY_AUTH_TOKEN='YOUR_SENTRY_AUTH_TOKEN'
`
  await fs.writeFile(envSentryPath, envSentryContent, 'utf-8')
}
