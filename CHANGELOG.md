# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.4] - 2026-08-08

### Changed

- **`unoff add specs` no longer asks which layers and platforms a spec touches.** Both questions came before the spec was written, and answering them meant knowing the architecture (`canvas`, `bridge`, `ui`, `config`, `externals`) to describe a product behaviour — backwards for anyone new, and guesswork at that point for everyone else. The command now asks only for the folder and a name
  - The frontmatter ships with `layers: []` and `platforms: []`, which already read as "all" everywhere they are consumed. The cost is context, never a wrong route
  - Two comment lines above each field list the valid values and say that empty means all, so narrowing it later is discoverable from inside the file — by you or by your assistant, once the spec actually says something
  - The starter spec seeded by `unoff ai` matches, instead of guessing `layers: [ui]`

## [0.4.3] - 2026-08-07

### Changed

- **Skills are free — both plugin templates now say so.** The welcome screen sold a subscription: a lone `unoff add skills` command, a "Subscribe to unlock a growing library of skills" message and a "Get skills access" button pointing at the store. All of it is gone
- **The welcome screen onboards specs and AI instead.** It is now a three-step `Section` — `unoff ai`, `unoff add specs`, `unoff sync specs` — each with its own explanation and command. The spec step is the one deliberately foregrounded ("This is the one that matters"), since the skills already describe *how* the template is built and only a spec describes *what* you are building
- The welcome message now separates what is free from what is not: the documentation is free and open to everyone, while guidance tailored to your own plugin — monitoring, analytics, licensing — is presented as something to unlock. The two CTAs point at `documentationUrl` and `storeUrl`
- Template `README.md` gained a **Building with AI** section: the three commands, how a spec's `layers` route an assistant to the right skill files, and both links
- Template `ARCHITECTURE.md` was rewritten where it had drifted since 0.4.1. It pointed at `.claude/skills/unoff-create-plugin/README.md` and documented `.cursor/rules/`, `.windsurf/`, `.claude/settings.json` and `.vscode/mcp.json` — none of which templates ship any more
  - The five layers are now a table of skill files with relative paths, instead of links hardcoded to `.claude/`
  - A new **Specs — what your plugin does** section sits right after the layer table
  - The AI tooling table lists what the CLI generates per assistant, not what the template ships
  - The directory tree shows `specs/`, `.unoff/skills/` and `unoff.config.json`, and drops the skills tree it no longer contains
  - **Adding a New Feature** starts with writing and syncing the spec, before the implementation steps

### Fixed

- `unoff --version` reported `0.2.0`. It was hardcoded in `cli.ts` and had not moved in five releases — it now reads `package.json`, so it cannot drift again
- The Penpot template welcomed users to "a production-ready template for building **Figma** plugins", in both English and French
- Removed the dead `template.skills` translation block from both templates — four keys no component had read since the welcome rework, including a "Get skills access" label

## [0.4.2] - 2026-08-06

### Fixed

- **`unoff add skills` produced a skill no assistant could load.** The submodule was checked out into `.claude/skills/unoff-create-plugin/`, but the unoff-skills repo root already contains a `unoff-create-plugin/` folder — so `SKILL.md` landed at `.claude/skills/unoff-create-plugin/unoff-create-plugin/SKILL.md`, one level below where Claude, Codex and Windsurf look. The skill was silently invisible
  - The submodule now goes to `.unoff/skills/` (outside every skills directory), and the skill itself is symlinked into each configured assistant's skills directory — so `SKILL.md` sits exactly where each one expects it. One source of truth: `git submodule update --remote` refreshes them all at once, with a copy fallback where symlinks are unavailable
  - Running `unoff add skills` on a project installed the old way detects the nested checkout, moves it up a level with `git mv`, and re-links it
  - Choosing a destination path that would nest again is rejected with an explanation instead of silently producing a dead skill
  - `unoff remove skills` cleans up the links it created, and never touches a real directory it did not place
  - `unoff ai` now re-links an existing skills submodule instead of overwriting it with a fresh copy

### Added

- **`unoff sync skills`** — re-point every configured skills directory at the submodule. Run it after changing the assistant list in `unoff.config.json`, or after a clone where the links did not survive. Idempotent, and it repairs a nested checkout on the way

### Changed

- **`unoff specs sync` is now `unoff sync specs`**, alongside `unoff sync skills` under a single `sync` command. The old form still works and prints a deprecation notice

## [0.4.1] - 2026-08-03

### Added

- **Cross-assistant configuration.** The CLI no longer assumes Claude Code. `unoff ai` asks which assistants the project targets, persists the answer in `unoff.config.json`, and installs skills, agents and specs in the format each one reads. `unoff ai status` reports what is configured and what is actually installed.
  - Supported: Claude Code, GitHub Copilot, ChatGPT/Codex, Cursor, Windsurf
  - Only Claude Code (`.claude/agents/*.md`) and Copilot (`.github/agents/*.agent.md`) have a file-based agent format; for the others agents degrade into a role table inlined in their rules file
  - Without a config file, commands fall back to detecting the assistants the project already shows traces of, then to the recommended defaults — nothing breaks for existing projects
- **`unoff add agents`** — installs the five unoff agents for every configured assistant. Definitions live in `agents/` of [yelbolt/unoff-skills](https://github.com/yelbolt/unoff-skills), shared with the Claude Code plugin, and are re-serialized per target with only the frontmatter keys that assistant understands
- Agents declare `layers` in the same vocabulary as functional specs, so a spec's layers resolve both to the skill files to read and to the agent that owns them

- **`unoff add rules`** — writes project rules and MCP config for every configured assistant, from a single neutral source in `rules/` of [yelbolt/unoff-skills](https://github.com/yelbolt/unoff-skills). The body is identical across targets; only the frontmatter differs (Cursor `alwaysApply`, Windsurf `trigger`). Existing files are left alone unless `--force`, and the managed specs block is carried over when they are replaced
- `unoff ai` asks for the Penpot instance URL (Cloud or self-hosted, stored in `unoff.config.json`) and optionally for the platform token, which is written to `.env.local` — never into a committed MCP file
- MCP now covers both endpoints per platform — hosted (`mcp.figma.com`, `design.penpot.app`) and machine-local (Figma desktop `127.0.0.1:3845`, Penpot dev server `localhost:4401`)
- MCP configuration is generated per assistant from one definition — `.claude/settings.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, `.windsurf/mcp.json` — merged into existing JSON so Claude permissions survive
- Skills are installed into the directory each assistant actually reads — `.claude/skills/`, `.agents/skills/` (Codex) or `.windsurf/skills/` — verified against `npx skills add -a '*'`. Cursor and Copilot read none, so their rules point at the canonical path instead. The canonical path follows the chosen assistants, so a Codex-only project never gets a `.claude/` folder
- `unoff ai` seeds a starter spec when the specs folder is empty, so the sync has something to index instead of skipping
- `unoff create` now ends by running the assistant setup, so a fresh project gets rules, agents and MCP for the assistants you actually use

### Fixed

- Windsurf MCP entries used `url`, which Windsurf ignores — it reads `serverUrl`. Every remote server was silently unavailable there
- Codex got no MCP configuration at all, despite supporting both stdio and streamable HTTP. It now gets `.codex/config.toml` in TOML, not JSON
- Penpot shipped only the local dev endpoint; the hosted Penpot MCP is now configured alongside it
- `unoff ai` deleted whole dot directories when pruning the skills fan-out, taking `.claude/agents/`, `.claude/settings.json` or Windsurf rules with them. It now removes the skill folder only, and its parents just while they are empty

### Changed

- **Templates no longer ship AI configuration.** `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/`, `.windsurf/`, `.vscode/mcp.json` and `.claude/settings.json` were removed from both plugin templates. They held ~800 lines per template saying the same thing four ways, already drifted apart (333 lines of diff between the Claude and Windsurf copies), and all hardcoded the Claude skills path. The CLI generates them per assistant instead
- `specs/INDEX.md` and the rules routing block now use the project's configured skills path instead of a hardcoded `.claude/skills/…`
- `unoff specs sync` is now config-driven: it writes only to the rules files of configured assistants, instead of to whichever instruction files happen to exist. Assistants you did not select are never touched
- Assistants without an agent format get the agent role table inlined in their rules block

## [0.4.0] - 2026-08-03

### Added

- **Functional specs are now discoverable by LLMs.** Specs previously landed in a folder no agent read; they are now wired into the same context as the implementation skills:
  - `unoff add specs` scaffolds a spec declaring the `layers` and `platforms` it touches, plus a Problem / User flow / Rules / Out of scope structure
  - `unoff specs sync` regenerates `specs/INDEX.md` — a layer → skill-file routing table — and injects a managed pointer block into the AI instruction files
  - The block is delimited by `<!-- unoff:specs:start -->` / `<!-- unoff:specs:end -->` and replaced in place, so re-running never duplicates and surrounding content is preserved
  - `AGENTS.md` is created when missing (cross-agent entry point for ChatGPT/Codex); other files are only updated when present
  - Specs logic extracted to `src/commands/specs.ts`; `addSpecs` and `toTitleCase` stay re-exported from `add.ts`
- Claude Code onboarding — `unoff help` gained a `CLAUDE CODE` section, and `unoff create` now points to the [unoff plugin](https://github.com/yelbolt/unoff-claude-plugin) (skill library + 5 layer-specialized agents) via the yelbolt marketplace
- `unoff add skills` now also surfaces the [skills.sh](https://skills.sh) alternative (`npx skills add yelbolt/unoff-skills`) and the plugin path
- Documented both skill installation routes — git submodule vs. skills.sh copy — in `README.md` and `USAGE.md`

### Fixed

- Updated the `@unoff/ui` link to `yelbolt/unoff-ui` (the repo moved from `a-ng-d`)
- `unoff add skills` defaulteé&d to `.claude/skills/unoff-create-skills`, while every template instruction file (`CLAUDE.md`, Cursor, Windsurf, Copilot) links to `.claude/skills/unoff-create-plugin` — accepting the default broke all of those links. The path is now a single shared constant (`SKILLS_PATH`)

## [0.3.0] - 2026-06-09

### Templates (Figma + Penpot)

Both templates now ship with an expanded example surface to better illustrate what a real plugin can do out of the box:

- **Welcome page** — introductory screen shown on first launch, presenting the plugin and linking to the documentation
- **Example page** — a new dedicated tab with three ready-to-run demos:
  - **To-do list** — add and manage tasks in the UI; each entry is written back to the Figma / Penpot document as a text node
  - **Color palette** — pick or enter colors in the UI; swatches are generated directly on the document canvas
  - **Layer inspector** — select any layer in the editor and the panel reflects its properties (name, type, dimensions, fill…) in real time

## [0.2.2] - 2026-05-23

### Fixed

- `package-lock.json`: removed spurious `libc` fields from optional dependency entries — these caused `npm install` and `npx @unoff/cli` failures on some environments (Alpine Linux, glibc-less CI runners)

### Templates (Figma + Penpot)

- `@unoff/ui` bumped to **1.24.2** in both Figma and Penpot templates

## [0.2.1] - 2026-05-15

### Fixed

- `start:dev` race condition: replaced `&` with `&&` in both Figma and Penpot templates — `vite preview` no longer starts before `dist/` exists
- `react/react-in-jsx-scope` ESLint error: added `plugin:react/jsx-runtime` to all `.eslintrc.json` configs, making the bare `import React from 'react'` unnecessary with the automatic JSX transform

### Changed

- Templates (Figma + Penpot): migrated to Preact-native JSX transform
  - `tsconfig.json`: `"jsx": "react"` → `"jsx": "react-jsx"` + `"jsxImportSource": "preact"` — TypeScript uses Preact's JSX types, eliminating the `@types/react` / Preact collision
  - `package.json`: removed `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@vitejs/plugin-react-swc` from devDependencies
  - Bare `import React from 'react'` removed from all files that only used it for JSX (automatic runtime handles it)
  - `ConfigContext.tsx`, `ThemeContext.tsx`: migrated to `createContext` / `useContext` / `useEffect` from `preact` and `preact/hooks`; `ReactNode` replaced with `ComponentChildren`
  - `WithTranslation.tsx`: `import type { ComponentType } from 'preact'`
  - `PlanControls.tsx`, `Feature.tsx`: `PureComponent` from `preact/compat`, `React.ReactNode` → `ComponentChildren`
  - Files using `React.Dispatch`, `React.ChangeEventHandler`, `React.MouseEvent` as type namespaces keep `import React from 'react'` — now resolved via `preact/compat`, no collision
- `start:dev` split into two composable scripts: `"build"` (watch) + `"preview"` (`vite preview`), launched together via `npm run build & npm run preview`
- README: installation section restructured — global install recommended, `npx @unoff/cli` documented as a drop-in alternative for all commands

### Templates (Figma + Penpot)

- Applied all changes above to both CLI scaffolding templates (`templates/figma`, `templates/penpot`) and standalone template repos (`unoff-template-figma`, `unoff-template-penpot`)

## [0.2.0] - 2026-05-06

### Added

- `unoff create penpot-plugin` — scaffold a Penpot plugin using the new `unoff-template-penpot` submodule
- Penpot plugin template (`unoff-template-penpot`) wired as a git submodule (`templates/penpot`)

### Changed

- `penpot-plugin` moved from "coming soon" to available in `create` command, `unoff help`, and README
- Quick Example in README extended with Penpot workflow and plugin loading instructions

### Fixed

- `penpot.ui.onMessage` was incorrectly assigned as a property; corrected to a method call `penpot.ui.onMessage(callback)` — resolves *"Cannot assign to read only property"* error introduced in Penpot 2.15+

### Skills (`unoff-skills`)

- Bridge and Canvas skill layers restructured into platform subdirectories:
  - `bridge/figma/` + `bridge/penpot/` — communication pattern and bridge functions per platform
  - `canvas/figma/` + `canvas/penpot/` — API, storage, and document generation per platform
- `app-bootstrap` skill updated with separate Figma and Penpot Canvas initialization sections
- `implement-design` skill extended with the Penpot MCP workflow (code-execution model via `@penpot/mcp`, selection-based, no URL parsing)
- Platform-specific annotations added to `app-bootstrap`, `error-handling`, `css-theming`, `i18n`, `state-management`, `payment-systems`, `types-system`, `credits-system`
- `SKILL.md` index updated to reflect the platform-split structure and improve agent routing

### Templates (Figma + Penpot)

- All AI tool rule files (CLAUDE.md, `.cursor/rules/project.mdc`, `.windsurf/rules/project.md`, `.github/copilot-instructions.md`) updated with new skill paths
- Penpot template: all Figma identity references corrected to Penpot (developer role, API calls, communication examples)
- Section comments added to all bridge files across both templates:
  - `loadUI.ts` — Startup / Announcements / Preferences / Storage / Browser / Plans / Auth
  - `checkCredits.ts` — 4 storage cases documented inline
  - `checkTrialStatus.ts` — storage reads, trial status, plan status, send result
  - `checkAnnouncementsStatus.ts` — storage reads, version comparison
  - Short files (`checkUserLicense`, `checkUserPreferences`, `checkEditor`, `enableTrial`, `payProPlan`) — descriptive header comment

## [0.1.5] - 2026-03-18

### Changed

- Figma plugin template (`unoff-template-figma`): `@unoff/ui` bumped to **1.23.0**
- Figma plugin template: package dependencies and overrides updated for compatibility

### Skills (`unoff-skills`)

- `component-library` skill: added **`SegmentedControl`** — props, usage, and reading the active segment from `data-feature`
- `component-library` skill: added **`ActionsList`** — low-level option list used internally by `Dropdown` and `Menu`, with standalone usage docs
- `component-library` skill: documented search props (`canBeSearched`, `searchLabel`, `noResultsLabel`) on `Dropdown`, `Menu`, and `ActionsList`
- `component-library` skill: expanded `Dropdown` and `Menu` props (`alignment`, `preview`, `warning`, `shouldReflow`, `isDisabled`, `onUnblock`, `customIcon`, `helper`)
- `component-library` skill: corrected `Menu` `type` values to `"ICON"` | `"PRIMARY"` (was `"PRIMARY"` | `"SECONDARY"`)
- `component-mapping` skill: `SegmentedControl` added to the Figma → `@unoff/ui` mapping table; `Knob` entry refined

## [0.1.4] - 2026-03-10

### Added

- `unoff create` now automatically runs `git init` in the newly created plugin directory if git is available
- README: new **Prerequisites** section documenting required software (Node.js ≥ 18, npm ≥ 9, git)

## [0.1.3] - 2026-03-06

### Added

- `unoff add worker <name>` — add a Cloudflare Worker as a git submodule (replaces `unoff add <worker>`)
- `unoff add skills` — add the [unoff-skills](https://github.com/yelbolt/unoff-skills) repository as a git submodule at a user-chosen path (default: `skills/`)
- `unoff add specs` — create a local specs folder with an empty skill template (YAML frontmatter + Markdown skeleton) at a user-chosen path (default: `specs/`)
- `unoff remove worker <name>` — remove a worker submodule and clean up `package.json` (replaces `unoff remove <worker>`)
- `unoff remove skills` — deinit and remove the skills submodule
- `unoff remove specs` — remove the local specs folder and all its contents
- Vitest test suite: 20 tests across 3 files (unit, fs integration, CLI smoke)
  - `tests/add.test.ts` — validates `WORKERS`, `WORKER_SCRIPTS`, `SKILLS_REPO`, `SPEC_TEMPLATE`, `toTitleCase`
  - `tests/specs.test.ts` — integration tests for `addSpecs()` and `removeSpecs()` using a real temp directory
  - `tests/cli.test.ts` — smoke tests spawning the compiled binary

### Changed

- Worker names no longer include the `-worker` suffix: `announcement`, `auth`, `cors`
- `add` and `remove` are now Commander parent commands with nested subcommands (`worker`, `skills`, `specs`)
- `help` output reorganised into separate **Add** and **Remove** sections listing all 6 subcommands

## [0.1.2] - 2026-03-04

### Added

- `isNotionEnabled` toggle in the interactive services prompt (Announcements & Onboarding)
- `isNotionEnabled` flag post-processed in `global.config.ts` alongside the other service flags
- `unoff create` now shows a clear "coming soon" message and exits cleanly for `penpot-plugin`, `sketch-plugin`, and `framer-plugin` instead of attempting scaffold
- `unoff help` now separates available platforms from coming soon platforms
- Service list (Supabase, Mixpanel, Sentry, Notion) displayed in `unoff help` under `create`

### Changed

- `.env.local` is now always fully generated with all vars regardless of selected services — only the flags in `global.config.ts` are toggled
- `.env.sentry-build-plugin` is now always generated unconditionally
- README and help output updated to reflect platform availability status

## [0.1.1] - 2026-03-04

### Added

- Figma plugin template wired as a git submodule (`templates/figma` → `yelbolt/unoff-template-figma`)
- `files` field in `package.json` to explicitly whitelist `bin/`, `dist/`, and `templates/` in the published npm package

### Fixed

- `prepare` script now gracefully skips `git submodule update` when installing from the npm registry (no `.git` context), preventing install failures with `npm install -g`
- `.npmignore` `src/` pattern anchored to `/src/` to prevent npm from accidentally excluding `templates/figma/src/` during publish

## [0.1.0] - 2026-01-13

### Added

- Initial release of @unoff/cli CLI
- `unoff create` command for creating plugins
- Support for Figma plugin template
- Automatic template variable replacement (pluginName, pluginSlug, githubUsername)
- Interactive prompts for plugin configuration
- Comprehensive Figma plugin template with:
  - Authentication (Supabase)
  - License management (LemonSqueezy)
  - Monitoring (Sentry)
  - Analytics (Mixpanel)
  - Announcements (Notion)
  - Localization (Tolgee)
  - UI components (@unoff/ui)
  - Worker integrations (@unoff/worker)

### Platform Support

- ✅ Figma plugin template (full)
- 🚧 Penpot plugin template (coming soon)
- 🚧 Sketch plugin template (coming soon)
- 🚧 Framer plugin template (coming soon)

[0.4.2]: https://github.com/yelbolt/unoff-cli/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/yelbolt/unoff-cli/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/yelbolt/unoff-cli/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yelbolt/unoff-cli/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/yelbolt/unoff-cli/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/yelbolt/unoff-cli/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/yelbolt/unoff-cli/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/yelbolt/unoff-cli/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/yelbolt/unoff-cli/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/yelbolt/unoff-cli/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/yelbolt/unoff-cli/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/yelbolt/unoff-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/yelbolt/unoff-cli/releases/tag/v0.1.0
