# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/yelbolt/unoff-cli/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/yelbolt/unoff-cli/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/yelbolt/unoff-cli/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/yelbolt/unoff-cli/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/yelbolt/unoff-cli/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/yelbolt/unoff-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/yelbolt/unoff-cli/releases/tag/v0.1.0
