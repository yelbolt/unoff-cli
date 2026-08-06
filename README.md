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
# Instead of: unoff create figma-plugin
npx @unoff/cli create figma-plugin

# Instead of: unoff dev
npx @unoff/cli dev

# Instead of: unoff build
npx @unoff/cli build
```

## Quick Example

```bash
# Scaffold a plugin (global install)
unoff create figma-plugin

# Or without global install
npx @unoff/cli create figma-plugin

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

### `unoff create <platform>`

Scaffold a new plugin project with an interactive prompt.

| Platform        | Status         |
| --------------- | -------------- |
| `figma-plugin`  | ✅ Available   |
| `penpot-plugin` | ✅ Available   |
| `sketch-plugin` | 🚧 Coming soon |
| `framer-plugin` | 🚧 Coming soon |

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

Add the [unoff-skills](https://github.com/yelbolt/unoff-skills) repository as a git submodule, then link it into the skills directory of every configured assistant.

```bash
unoff add skills
git submodule update --init --recursive
```

The submodule lands in `.unoff/skills/` by default — **outside** your skills directories on purpose. The repo root holds a `unoff-create-plugin/` folder, so cloning it straight into `.claude/skills/unoff-create-plugin/` would bury `SKILL.md` one level too deep and no assistant would ever load it. Instead each skills directory gets a symlink to the skill itself:

```
.unoff/skills/                                        # submodule (whole repo)
  unoff-create-plugin/SKILL.md
.claude/skills/unoff-create-plugin  ->  ../../.unoff/skills/unoff-create-plugin
.agents/skills/unoff-create-plugin  ->  ../../.unoff/skills/unoff-create-plugin
```

One source of truth: `git submodule update --remote` refreshes every assistant at once. On platforms that refuse symlinks the CLI falls back to a copy. Run [`unoff sync skills`](#unoff-sync-skills) after changing which assistants the project targets.

If you already installed the submodule the old way, `unoff add skills` detects it, moves it up a level, and links it back in.

The version is pinned in your project's history — update it deliberately with `git submodule update --remote`.

**Alternative — [skills.sh](https://skills.sh)**, if you would rather copy the files than track a submodule:

```bash
npx skills add yelbolt/unoff-skills
```

This installs into every agent directory it detects (`.claude/`, `.cursor/`, …) instead of a single path, and records provenance in `skills-lock.json`. No git submodule, no pinning.

Both give you the skill library only. For skills **plus** specs **plus** agents, wired per assistant, see [AI assistants](#ai-assistants) below.

### `unoff add specs`

Scaffold a **functional spec** — what the product does, as opposed to the skills, which describe how it is built. The prompt asks for the folder, the spec name, and the **layers** and **platforms** it touches.

```bash
unoff add specs
# → specs/credits-paywall.md
```

```markdown
---
name: credits-paywall
description: Functional spec — metered exports with a paywall past the free tier.
layers: [ui, config, bridge]
platforms: [figma, penpot]
status: draft
---

# Credits Paywall

## Problem

## User flow

## Rules

## Acceptance criteria

- [ ] Given <context>, when <action>, then <observable outcome>

## Out of scope

## Implementation notes
```

`layers` is the part that matters: it is how an agent goes from _what to build_ to _which architecture docs to read_. A spec declaring `layers: [ui, config]` tells the agent to load `ui/component-patterns.md`, `config/feature-flags.md` and the rest of those layers from the skill library — no guessing.

### `unoff sync specs`

Regenerate `specs/INDEX.md` and point every AI instruction file at it. Run it after adding a spec by hand, or after editing frontmatter.

```bash
unoff sync specs          # auto-detects specs/, docs/specs/ or .specs/
unoff sync specs docs/specs
```

It writes a managed block, delimited by `<!-- unoff:specs:start -->` / `<!-- unoff:specs:end -->`, into the rules file of **each assistant configured in `unoff.config.json`** — see [AI assistants](#ai-assistants) for the mapping. Assistants you did not select are never touched.

Two extra behaviours worth knowing:

- An assistant's **canonical** entry point (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`) is created if missing. Secondary rules files (Cursor, Windsurf) are only updated when they already exist.
- Assistants with **no agent file format** also get the agent role table inlined, so the same routing information reaches them as instructions.

Re-running replaces the block in place — it never duplicates, and everything outside the markers is left untouched. `AGENTS.md` is the only file created on demand, since it is the cross-agent entry point and templates do not ship one.

The result is that an agent asked to "add the paywall" reads the spec **and** the matching skill files, instead of one or the other.

> Renamed from `unoff specs sync`. The old form still works and prints a deprecation notice.

### `unoff sync skills`

Re-point every configured skills directory at the [skills submodule](#unoff-add-skills). Run it after changing the assistant list in `unoff.config.json`, or after a fresh clone on a platform where the links did not survive.

```bash
unoff sync skills
```

It is idempotent, and it repairs a submodule that was checked out inside a skills directory by moving it up a level first.

### `unoff remove worker <name>`

Remove a worker submodule and clean up `package.json` (workspaces + scripts).

```bash
unoff remove worker announcement
```

### `unoff remove skills`

Remove the skills submodule from the project, along with the links it placed in each assistant's skills directory.

```bash
unoff remove skills
```

### `unoff remove specs`

Remove the local specs folder and all its contents.

```bash
unoff remove specs
```

## AI assistants

The CLI is assistant-agnostic. It installs **three pieces**, each in the format the assistant actually reads:

| Piece      | Answers        | Source                                                          |
| ---------- | -------------- | --------------------------------------------------------------- |
| **Skills** | _how we build_ | [yelbolt/unoff-skills](https://github.com/yelbolt/unoff-skills) |
| **Specs**  | _what it does_ | your `specs/` folder                                            |
| **Agents** | _who does it_  | `agents/` in the same skills repo                               |

Start here:

```bash
unoff ai          # pick assistants, then install all three
unoff ai status   # what is configured, what is installed
```

Your choice is persisted in `unoff.config.json` and committed, so the whole team targets the same set. Every other command (`add agents`, `sync specs`) reads it. Without a config file, the CLI falls back to detecting which assistants the project already shows traces of.

### What each assistant gets

| Assistant       | Rules                             | Skills              | Agents                      | MCP                                    |
| --------------- | --------------------------------- | ------------------- | --------------------------- | -------------------------------------- |
| Claude Code     | `CLAUDE.md`                       | `.claude/skills/`   | `.claude/agents/*.md`       | `.claude/settings.json` — `url`        |
| GitHub Copilot  | `.github/copilot-instructions.md` | — via rules path    | `.github/agents/*.agent.md` | `.vscode/mcp.json` — `type` + `url`    |
| ChatGPT / Codex | `AGENTS.md`                       | `.agents/skills/`   | role table in rules         | `.codex/config.toml` — **TOML**        |
| Cursor          | `.cursor/rules/project.mdc`       | — via rules path    | role table in rules         | `.cursor/mcp.json` — `url`             |
| Windsurf        | `.windsurf/rules/project.md`      | `.windsurf/skills/` | role table in rules         | `.windsurf/mcp.json` — **`serverUrl`** |

Every column is a capability some tools have and others don't, so the CLI degrades rather than pretends:

- **Agents** — only Claude Code and Copilot have a file-based format. For the rest, agents become a role table inlined in the rules file they already read: same routing information, expressed as instructions.
- **Skills** — only Claude Code, Codex and Windsurf read a skills directory (verified against `npx skills add -a '*'`; Cursor and Copilot create none). The library is installed once at a canonical path, and every rules file points at it explicitly — so it works even where there is no native directory.
- **MCP** — one server definition per platform, four different spellings. Windsurf reads `serverUrl` and silently ignores a plain `url`; Codex reads TOML, not JSON; VS Code wants an explicit `type: "http"`. Each platform ships a hosted endpoint **and** a machine-local one (Figma desktop on `127.0.0.1:3845`, the Penpot dev server on `localhost:4401`). The write **merges** into existing JSON, so Claude's `permissions` survive.

The canonical skills path follows the assistants you chose: `.claude/skills/…` when Claude is in the set, otherwise `.agents/skills/…`. A Codex-only project never ends up with a `.claude/` folder.

### `unoff add agents`

Install the five agents for every configured assistant. Definitions come from `agents/` in the skills repo — one source, several output formats.

```bash
unoff add agents
```

| Agent                        | Layers                | Owns                                                                            |
| ---------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| `unoff-plugin-architect`     | all                   | Resolves the target platform, decomposes and sequences work by layer            |
| `unoff-canvas-bridge`        | `canvas`, `bridge`    | `src/index.ts`, `src/canvas/`, `src/bridges/` — Canvas APIs, storage, messaging |
| `unoff-ui`                   | `ui`                  | `src/app/` — Preact, `@unoff/ui`, Nanostores, theming, Tolgee, a11y             |
| `unoff-platform-services`    | `config`, `externals` | `global.config.ts`, Vite, feature flags, credits, external services, payments   |
| `unoff-conformance-reviewer` | all                   | Quality gate — conventions, message contracts, Figma/Penpot parity, build       |

Agents declare `layers` in the **same vocabulary as specs**. That is what closes the loop: a spec says which layers it touches, the skill library is organised by layer, and each agent owns a set of layers — so an assistant can resolve both which docs to read and which role to adopt.

### Claude Code plugin

Claude users can get skills **and** agents pre-wired as a plugin instead of running `unoff ai`:

```bash
/plugin marketplace add yelbolt/claude-marketplace
/plugin install unoff@yelbolt
```

The marketplace is shared with the other yelbolt plugins, so the first command is only needed once. Later releases: `/plugin marketplace update yelbolt`. Specs still come from `unoff add specs` and `unoff sync specs` — they describe your product, not ours.

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
- 📚 Skills library via git submodule (`add skills` / `remove skills`) or [skills.sh](https://skills.sh)
- 📐 Functional specs discoverable by any LLM (`add specs` / `sync specs`) — layer-routed to the implementation skills
- 🤖 Claude Code plugin with 5 layer-specialized agents (`yelbolt/claude-marketplace`)
- 📝 Project specs scaffolding (`add specs` / `remove specs`)
- 📚 Comprehensive AI-assistant documentation

## What's included in the template?

### UI & Components

- [@unoff/ui](https://github.com/yelbolt/unoff-ui) — Pre-built UI components for design tool plugins

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
