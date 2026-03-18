# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.5]: https://github.com/yelbolt/unoff-cli/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/yelbolt/unoff-cli/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/yelbolt/unoff-cli/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/yelbolt/unoff-cli/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/yelbolt/unoff-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/yelbolt/unoff-cli/releases/tag/v0.1.0
