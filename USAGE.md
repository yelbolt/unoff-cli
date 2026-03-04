# Unoff CLI Usage Guide

## Installation

### Global installation (recommended)

```bash
npm install -g @unoff/cli
```

After installation, you can use the `unoff` command anywhere:

```bash
unoff create figma-plugin
```

### Using with npx (no installation)

```bash
npx @unoff/cli create figma-plugin
```

## Commands

### `unoff help`

Display all available commands, platforms, and workers with usage examples.

```bash
unoff help
```

---

### `unoff create <platform>`

Create a new plugin for a specific platform.

**Platforms:**

- `figma-plugin` — Create a Figma plugin
- `penpot-plugin` — Create a Penpot plugin (coming soon)
- `sketch-plugin` — Create a Sketch plugin (coming soon)
- `framer-plugin` — Create a Framer plugin (coming soon)

**Examples:**

```bash
# Interactive mode — will prompt for all information
unoff create figma-plugin

# Custom output directory
unoff create figma-plugin --dir ./my-projects
```

---

### `unoff dev`

Start development mode. Runs `npm run start:dev` in the current plugin directory.

```bash
cd your-plugin
unoff dev
```

---

### `unoff build`

Build your plugin for production. Runs `npm run build:prod`.

```bash
cd your-plugin
unoff build
```

---

### `unoff check`

Run lint and type checking sequentially. Runs `npm run lint` then `npm run typecheck`.

```bash
cd your-plugin
unoff check
```

---

### `unoff format`

Format source code. Runs `npm run format`.

```bash
cd your-plugin
unoff format
```

---

### `unoff add <worker>`

Add a Cloudflare Worker as a git submodule, register it in `package.json` workspaces, and inject its start script.

**Available workers:**

| Worker | Script added | Port |
|---|---|---|
| `announcement-worker` | `start:announcements` | 8888 |
| `auth-worker` | `start:token` | 8787 |
| `cors-worker` | `start:cors` | 8989 |

**Examples:**

```bash
# Add the announcement worker (will prompt for the submodule path)
unoff add announcement-worker

# Add the auth worker
unoff add auth-worker
```

After adding a worker:

```bash
# Install dependencies (including the new workspace)
npm install

# Start the worker locally
npm run start:announcements   # or start:token / start:cors
```

---

### `unoff remove <worker>`

Remove a worker submodule and clean up all related entries in `package.json` (workspaces + scripts).

```bash
unoff remove announcement-worker
```

This command:
1. Looks up the submodule path from `.gitmodules`
2. Asks for confirmation
3. Runs `git submodule deinit` + `git rm`
4. Removes `.git/modules/<path>` leftovers
5. Removes the path from `workspaces` and the associated scripts from `package.json`

---

## Template Variables

When creating a plugin, the CLI will ask for information and replace template variables:

- `{{ pluginName }}` → The name you provide (e.g., "My Awesome Plugin")
- `{{ pluginSlug }}` → Auto-generated slug (e.g., "my-awesome-plugin")
- `{{ githubUsername }}` → Your GitHub username

These variables are replaced in all relevant files:

- `manifest.json` — Plugin name
- `package.json` — Package name and repository
- `README.md` — Documentation and badges
- Source files with plugin references

## After Creating a Plugin

```bash
# 1. Navigate to the plugin directory
cd your-plugin-name

# 2. Install dependencies
npm install

# 3. Start development
unoff dev

# 4. In Figma: Plugins > Development > Import plugin from manifest...
# Select the manifest.json file from your plugin directory
```

### AI Tools Configuration

The generated template includes configuration files for AI coding assistants:

- `.github/copilot-instructions.md` — GitHub Copilot
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `.clauderules` — Claude (VS Code)
- `.mcp.json` — MCP servers (Figma design-to-code)
- `.github/skills/` — Detailed skills documentation referenced by all AI tools

These files provide context about the project architecture, component library (`@unoff/ui`), and coding patterns so AI tools generate correct code out of the box.

## Environment Setup

The template requires environment variables. Create a `.env` file in your plugin directory:

```env
# Required for authentication
VITE_SUPABASE_PUBLIC_ANON_KEY=your-supabase-key

# Required for analytics
VITE_MIXPANEL_TOKEN=your-mixpanel-token

# Required for error monitoring
VITE_SENTRY_DSN=your-sentry-dsn

# Required for AI features (optional)
VITE_MISTRAL_AI_API_KEY=your-mistral-api-key

# Required for localization
VITE_TOLGEE_API_KEY=your-tolgee-api-key
VITE_TOLGEE_URL=your-tolgee-url

# Required for licensing
VITE_LEMONSQUEEZY_URL=your-lemonsqueezy-url

# Required for workers
VITE_AUTH_WORKER_URL=your-auth-worker-url
VITE_ANNOUNCEMENTS_WORKER_URL=your-announcements-worker-url
VITE_CORS_WORKER_URL=your-cors-worker-url

# Required for content management
VITE_NOTION_ANNOUNCEMENTS_ID=your-notion-db-id
VITE_NOTION_ONBOARDING_ID=your-notion-db-id
VITE_NOTION_API_KEY=your-notion-api-key
```

## Development Workflow

```bash
# Development build with watch mode
unoff dev
# or: npm run start:dev

# Production build
unoff build
# or: npm run build:prod

# Type checking + lint
unoff check

# Code formatting
unoff format
```

## Publishing

Before publishing your plugin:

1. Update the `id` in `manifest.json` with your plugin ID from Figma
2. Update `package.json` with your plugin details
3. Configure all environment variables
4. Test thoroughly in Figma
5. Build for production: `unoff build`
6. Submit to Figma Community

## Troubleshooting

### Command not found: unoff

Make sure you installed the package globally:

```bash
npm install -g @unoff/cli
```

Or use npx:

```bash
npx @unoff/cli create figma-plugin
```

### Template not found

Make sure you're using a valid platform name:

- `figma-plugin` ✅
- `figma` ❌

### Directory already exists

If the output directory already exists, the CLI will ask if you want to overwrite it. Choose 'Yes' to continue or 'No' to cancel.

## Support

For issues or questions:

- GitHub Issues: [unoff-cli/issues](https://github.com/yelbolt/unoff-cli/issues)
- Documentation: [unoff.dev](https://unoff.dev)
