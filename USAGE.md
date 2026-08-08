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
- `penpot-plugin` — Create a Penpot plugin
- `sketch-plugin` — Create a Sketch plugin (coming soon)
- `framer-plugin` — Create a Framer plugin (coming soon)

**Examples:**

```bash
# Interactive mode — will prompt for all information
unoff create figma-plugin
unoff create penpot-plugin

# Custom output directory
unoff create figma-plugin --dir ./my-projects
unoff create penpot-plugin --dir ./my-projects
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

| Worker                | Script added          | Port |
| --------------------- | --------------------- | ---- |
| `announcement-worker` | `start:announcements` | 8888 |
| `auth-worker`         | `start:token`         | 8787 |
| `cors-worker`         | `start:cors`          | 8989 |

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
```

### Figma

```bash
# 4. In Figma: Plugins > Development > Import plugin from manifest...
#    Select the manifest.json file from your plugin directory
```

The `manifest.json` is at the root of the project. Figma loads the plugin directly from the filesystem.

### Penpot

```bash
# 4. In Penpot: Main menu > Plugins > Manage plugins > Add plugin (+)
#    Enter: http://localhost:4400/manifest.json
```

The `manifest.json` is served from `public/` at the root of the dev server (port `4400`). Penpot loads the plugin via URL — make sure `unoff dev` is running before connecting.

---

### AI Tools Configuration

The template ships **no** assistant configuration. `unoff create` ends by asking
which assistants you use, and writes only those — no dead `.cursor/` folder in a
project that never opens Cursor.

Rules, agents and MCP config are generated per assistant from a single source in
[yelbolt/unoff-skills](https://github.com/yelbolt/unoff-skills). Re-run at any
time:

```bash
unoff ai                 # reconfigure and reinstall
unoff add rules          # rules + MCP only
unoff add rules --force  # regenerate rules that already exist
```

| Assistant       | Rules                             | Skills              | MCP                     | Agents                      |
| --------------- | --------------------------------- | ------------------- | ----------------------- | --------------------------- |
| Claude Code     | `CLAUDE.md`                       | `.claude/skills/`   | `.claude/settings.json` | `.claude/agents/*.md`       |
| GitHub Copilot  | `.github/copilot-instructions.md` | — via rules path    | `.vscode/mcp.json`      | `.github/agents/*.agent.md` |
| ChatGPT / Codex | `AGENTS.md`                       | `.agents/skills/`   | `.codex/config.toml`    | role table in rules         |
| Cursor          | `.cursor/rules/project.mdc`       | — via rules path    | `.cursor/mcp.json`      | role table in rules         |
| Windsurf        | `.windsurf/rules/project.md`      | `.windsurf/skills/` | `.windsurf/mcp.json`    | role table in rules         |

Each platform gets a hosted endpoint and a machine-local one:

| Platform | Remote                                   | Local                                            |
| -------- | ---------------------------------------- | ------------------------------------------------ |
| Figma    | `mcp.figma.com/mcp`                      | Figma desktop `127.0.0.1:3845` + `figma-console` |
| Penpot   | `design.penpot.app/mcp/stream?userToken` | dev server `localhost:4401` via `mcp-remote`     |

`unoff ai` asks for the Penpot instance URL — Cloud or self-hosted — and stores it in `unoff.config.json`, which is safe to commit.

Tokens are different. The wizard offers to store them in `.env.local` (gitignored) and **never writes a value into an MCP file**. How the token then reaches the server depends on the tool:

| Assistant              | Token in a server URL                 |
| ---------------------- | ------------------------------------- |
| Claude Code            | `${PENPOT_USER_TOKEN}` — expanded     |
| Windsurf               | `${env:PENPOT_USER_TOKEN}` — expanded |
| Cursor, Copilot, Codex | placeholder — paste it yourself       |

Only Claude and Windsurf document env expansion inside a `url`, so the others keep a `YOUR_PENPOT_USER_TOKEN` placeholder and the wizard says so rather than writing something that silently fails. For Figma, `figma-console` takes its token through `env`, which every tool supports — and the Codex TOML references it by variable **name** (`env_vars`), so nothing sensitive lands there either.

The rules **body is byte-identical** across every target — only the frontmatter
differs, because that is all that actually differs between these tools. Existing
rules files are never overwritten without `--force`, and the managed specs block
is carried across when they are.

#### Claude Code plugin

For Claude Code specifically, install the [unoff plugin](https://github.com/yelbolt/unoff-claude-plugin) — the skill library plus five agents scoped to the architecture layers (Canvas, Bridge, UI, Config/Externals) and a conformance reviewer that checks the diff against the stack conventions before you ship:

```bash
/plugin marketplace add yelbolt/claude-marketplace
/plugin install unoff@yelbolt
```

Adding the marketplace is a one-time step shared with the other yelbolt plugins; refresh later with `/plugin marketplace update yelbolt`.

#### Functional specs

Skills describe **how** this architecture works. They say nothing about **what
your** plugin does. `unoff add specs` covers that second half, in a form agents
discover on their own:

```bash
unoff add specs      # scaffold a spec — asks for the folder and a name, nothing more
unoff sync specs     # rebuild specs/INDEX.md + point every agent file at it
```

Each spec carries a `layers:` field in its frontmatter (`canvas`, `bridge`, `ui`,
`config`, `externals`). `specs/INDEX.md` maps those layers to the matching skill
files, so an agent reading a spec knows exactly which architecture docs to load
with it. It is scaffolded **empty**, which means "all of them" — you describe the
feature first and narrow the routing later, rather than having to name layers
before you have written a line of product. `sync specs` writes a managed block
into the rules file of each configured assistant — replacing it in place on every
run, never touching the others.

Everything outside the `<!-- unoff:specs:start -->` markers is preserved. If the
specs folder is empty, `unoff ai` seeds a starter spec so the index has something
to point at.

#### Skill library on its own

If you want the documentation without the agents — for another assistant, or pinned in your repo — install the skills directly:

```bash
unoff add skills                      # git submodule, version pinned in your history
npx skills add yelbolt/unoff-skills   # copied files, installs into any detected agent
```

`unoff add skills` checks the submodule out into `.unoff/skills/` and links the skill into each assistant's skills directory (`.claude/skills/unoff-create-plugin`, `.agents/skills/unoff-create-plugin`, …). The submodule stays outside those directories because the repo root already contains a `unoff-create-plugin/` folder — cloning it in place would leave `SKILL.md` a level too deep for any assistant to find. Re-link with `unoff sync skills` whenever you change the assistant list.

Skip both if you installed the Claude Code plugin: it already ships the same library.

#### MCP servers

Each template ships with pre-configured MCP servers for design-to-code workflows.

**Figma** (`.vscode/mcp.json`, `.cursor/mcp.json`, `.windsurf/mcp.json`):

```json
{
  "servers": {
    "figma": { "type": "http", "url": "https://mcp.figma.com/mcp" },
    "figma-desktop": { "type": "http", "url": "http://127.0.0.1:3845/mcp" },
    "figma-console": {
      "command": "npx",
      "args": ["-y", "figma-console-mcp@latest"],
      "env": { "FIGMA_ACCESS_TOKEN": "figd_YOUR_TOKEN_HERE" }
    }
  }
}
```

Replace `figd_YOUR_TOKEN_HERE` with a [Figma personal access token](https://help.figma.com/hc/en-us/articles/8085703771159).

**Penpot** (`.vscode/mcp.json`, `.cursor/mcp.json`, `.windsurf/mcp.json`):

```json
{
  "servers": {
    "penpot": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:4401/mcp", "--allow-http"]
    }
  }
}
```

The Penpot MCP server runs on port `4401` alongside the plugin dev server (port `4400`). Both are started by `unoff dev`.

---

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

### Figma

Before publishing your plugin:

1. Update the `id` in `manifest.json` with your plugin ID from Figma
2. Update `package.json` with your plugin details
3. Configure all environment variables
4. Test thoroughly in Figma
5. Build for production: `unoff build`
6. Submit to [Figma Community](https://www.figma.com/community)

### Penpot

Before publishing your plugin:

1. Host the production build on a public server (the `public/` folder is served at the root)
2. Update `public/manifest.json` with your plugin details
3. Configure all environment variables
4. Test thoroughly in Penpot using the hosted manifest URL
5. Build for production: `unoff build`
6. Submit to [Penpot Community](https://community.penpot.app) with your manifest URL

**Beta testing** — to share a build before hosting:

1. Go to the repository's GitHub Actions tab
2. Run the `Build and Download` workflow on any branch
3. Download the artifact (a ZIP of the built plugin)
4. Unzip and serve locally (MAMP, WAMP, http-server, etc.)
5. In Penpot: Manage plugins > Add plugin > enter `http://localhost:{yourPort}/manifest.json`

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
- `penpot-plugin` ✅
- `figma` ❌

### Directory already exists

If the output directory already exists, the CLI will ask if you want to overwrite it. Choose 'Yes' to continue or 'No' to cancel.

### Penpot — plugin not loading

- Make sure `unoff dev` is running (serves on port `4400`)
- Check that the URL entered in Penpot is exactly `http://localhost:4400/manifest.json`
- Check the browser console for CORS errors — the `public/CORS` and `public/_headers` files handle this in production

## Support

For issues or questions:

- GitHub Issues: [unoff-cli/issues](https://github.com/yelbolt/unoff-cli/issues)
- Documentation: [unoff.dev](https://unoff.dev)
