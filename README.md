# Unoff CLI

A CLI tool to quickly scaffold plugins for Figma, Penpot, Sketch, and Framer with built-in development tools and best practices.

## Installation

Install globally:

```bash
npm install -g @unoff/cli
```

Or use with npx (no installation required):

```bash
npx @unoff/cli create figma-plugin
```

## Quick Example

```bash
# Install globally
npm install -g @unoff/cli

# Create a new Figma plugin (will prompt for name)
unoff create figma-plugin

# Navigate to the plugin directory
cd color-palette-generator

# Install dependencies
npm install

# Start development
unoff dev

# Open Figma and load the plugin:
# Plugins > Development > Import plugin from manifest...
# Select manifest.json from the plugin folder
```

## CLI Commands

### `unoff help`

Show all commands, available platforms, and workers.

### `unoff create <platform>`

Scaffold a new plugin project. Platforms: `figma-plugin`, `penpot-plugin`, `sketch-plugin`, `framer-plugin`.

```bash
unoff create figma-plugin
```

### `unoff dev`

Start development mode (`npm run start:dev`).

### `unoff build`

Build for production (`npm run build:prod`).

### `unoff check`

Run lint and type checking sequentially.

### `unoff format`

Format source code with Prettier.

### `unoff add <worker>`

Add a Cloudflare Worker as a git submodule. Automatically updates `package.json` workspaces and injects the corresponding start script.

| Worker                | Script                | Port |
| --------------------- | --------------------- | ---- |
| `announcement-worker` | `start:announcements` | 8888 |
| `auth-worker`         | `start:token`         | 8787 |
| `cors-worker`         | `start:cors`          | 8989 |

```bash
unoff add announcement-worker
npm install
npm run start:announcements
```

### `unoff remove <worker>`

Remove a worker submodule and clean up `package.json` (workspaces + scripts).

```bash
unoff remove announcement-worker
```

## Features

- 🚀 Quick setup with interactive CLI
- 📦 Multiple platform support (Figma, Penpot, Sketch, Framer)
- 🔧 Built-in development server with hot reload
- 🏗️ Production-ready build system
- 🔐 Authentication scaffolding (Supabase)
- 💳 License management (LemonSqueezy)
- 📊 Analytics and monitoring (Mixpanel, Sentry)
- 🌍 Internationalization (Tolgee)
- 📢 Announcement & onboarding system (Notion + Cloudflare Workers)
- ⚙️ Worker management via git submodules
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
