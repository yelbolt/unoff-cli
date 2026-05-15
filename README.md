# Unoff CLI

A CLI tool to quickly scaffold plugins for Figma, Penpot, Sketch, and Framer with built-in development tools and best practices.

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **git** — required for `unoff create` (initializes a git repository) and for all `unoff add` commands (workers, skills, specs use git submodules)

## Installing Prerequisites

### Homebrew (macOS only)

If you don't have Homebrew installed, open **Terminal** and install it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then verify:

```bash
brew --version
```

### Node.js and npm

**On macOS:**
Open **Terminal** and run:

```bash
# Using Homebrew (requires Homebrew to be installed)
brew install node
```

**On Windows:**

1. Download the installer from [nodejs.org](https://nodejs.org)
2. Run the installer and follow the setup wizard
3. Open **Command Prompt** (cmd.exe) or **PowerShell** and verify installation:
   ```bash
   node --version
   npm --version
   ```

**On Linux (Ubuntu/Debian):**
Open **Terminal** and run:

```bash
sudo apt update
sudo apt install nodejs npm
```

**On Linux (Fedora/CentOS):**
Open **Terminal** and run:

```bash
sudo dnf install nodejs npm
```

### Git

**On macOS:**
Open **Terminal** and run:

```bash
# Using Homebrew
brew install git
```

**On Windows:**

1. Download the installer from [git-scm.com](https://git-scm.com)
2. Run the installer and follow the setup wizard
3. Open **Command Prompt** (cmd.exe) or **PowerShell** and verify installation:
   ```bash
   git --version
   ```

**On Linux (Ubuntu/Debian):**
Open **Terminal** and run:

```bash
sudo apt update
sudo apt install git
```

**On Linux (Fedora/CentOS):**
Open **Terminal** and run:

```bash
sudo dnf install git
```

## Installation

A global install is recommended — it makes every `unoff` command available directly in any plugin project:

```bash
npm install -g @unoff/cli
```

If you prefer not to install globally, every command works with `npx @unoff/cli` as a drop-in replacement:

```bash
# Instead of: unoff create-figma-plugin
npx @unoff/cli create-figma-plugin

# Instead of: unoff dev
npx @unoff/cli dev

# Instead of: unoff build
npx @unoff/cli build
```

## Quick Example

```bash
# Scaffold a plugin (global install)
unoff create-figma-plugin

# Or without global install
npx @unoff/cli create-figma-plugin

# Navigate to the plugin directory
cd my-plugin

# Install dependencies
npm install

# Start development (or: npx @unoff/cli dev)
unoff dev

# Figma: Plugins > Development > Import plugin from manifest...
# Penpot: Plugins > Add custom plugin > http://localhost:4400/manifest.json
```

## CLI Commands

### `unoff help`

Show all commands, available platforms, and workers.

### `unoff create-figma-plugin` / `unoff create-penpot-plugin`

Scaffold a new plugin project with an interactive prompt.

| Command                      | Status         |
| ---------------------------- | -------------- |
| `unoff create-figma-plugin`  | ✅ Available   |
| `unoff create-penpot-plugin` | ✅ Available   |
| `unoff create-sketch-plugin` | 🚧 Coming soon |
| `unoff create-framer-plugin` | 🚧 Coming soon |

The interactive prompt will ask for plugin name, output directory, GitHub username, author, license, and which external services to enable:

| Service                              | Default |
| ------------------------------------ | ------- |
| Supabase (Database & Authentication) | ✅      |
| Mixpanel (Analytics)                 | ✅      |
| Sentry (Error Monitoring)            | ✅      |
| Notion (Announcements & Onboarding)  | ✅      |

Selected services update the `is*Enabled` flags in `global.config.ts`. All environment variable placeholders are always generated in `.env.local`.

### `unoff dev`

Start development mode (`npm run start:dev`).

### `unoff build`

Build for production (`npm run build:prod`).

### `unoff check`

Run lint and type checking sequentially.

### `unoff format`

Format source code with Prettier.

### `unoff add worker <name>`

Add a Cloudflare Worker as a git submodule. Automatically updates `package.json` workspaces and injects the corresponding start script. You will be prompted for the destination path.

| Worker         | Script                | Port |
| -------------- | --------------------- | ---- |
| `announcement` | `start:announcements` | 8888 |
| `auth`         | `start:token`         | 8787 |
| `cors`         | `start:cors`          | 8989 |

```bash
unoff add worker announcement
npm install
npm run start:announcements
```

### `unoff add skills`

Add the [unoff-skills](https://github.com/yelbolt/unoff-skills) repository as a git submodule. You will be prompted for the destination path (default: `skills/`).

```bash
unoff add skills
git submodule update --init --recursive
```

### `unoff add specs`

Create a local `specs/` folder (or any path you choose) with an empty skill template in Markdown. Useful for documenting project-specific conventions in the same format as unoff-skills.

```bash
unoff add specs
# prompts for folder path and spec name
# creates specs/my-spec.md with frontmatter skeleton
```

### `unoff remove worker <name>`

Remove a worker submodule and clean up `package.json` (workspaces + scripts).

```bash
unoff remove worker announcement
```

### `unoff remove skills`

Remove the skills submodule from the project.

```bash
unoff remove skills
```

### `unoff remove specs`

Remove the local specs folder and all its contents.

```bash
unoff remove specs
```

## Features

- 🚀 Quick setup with interactive CLI
- 📦 Multiple platform support (Figma ✅, Penpot ✅, Sketch 🚧, Framer 🚧)
- 🔧 Built-in development server with hot reload
- 🏗️ Production-ready build system
- 🎛️ Toggleable external services (Supabase, Mixpanel, Sentry, Notion)
- 🔐 Authentication scaffolding (Supabase)
- 💳 License management (LemonSqueezy)
- 📊 Analytics and monitoring (Mixpanel, Sentry)
- 🌍 Internationalization (Tolgee)
- 📢 Announcement & onboarding system (Notion + Cloudflare Workers)
- ⚙️ Worker management via git submodules (`add worker` / `remove worker`)
- 📚 Skills library integration via git submodule (`add skills` / `remove skills`)
- 📝 Project specs scaffolding (`add specs` / `remove specs`)
- 📚 Comprehensive AI-assistant documentation

## What's included in the template?

### UI & Components

- [@unoff/ui](https://github.com/a-ng-d/unoff-ui) — Pre-built UI components for design tool plugins

### Authentication & Database

- [Supabase](https://supabase.com) — Backend as a Service for authentication and database

### Licensing & Payments

- [LemonSqueezy](https://lemonsqueezy.com) — License management and payments

### Monitoring & Analytics

- [Sentry](https://sentry.io) — Error tracking and performance monitoring
- [Mixpanel](https://mixpanel.com) — Product analytics

### Content & Communication

- [Notion](https://notion.so) — CMS for announcements and onboarding
- Cloudflare Workers — Proxy layer for Notion API (auth + CORS)

### Localization

- [Tolgee](https://tolgee.io) — Translation management and i18n

## Documentation

For detailed usage instructions, see [USAGE.md](./USAGE.md).

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/yelbolt/unoff-cli).

## License

MPL-2.0
