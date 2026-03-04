# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.1]: https://github.com/yelbolt/unoff-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/yelbolt/unoff-cli/releases/tag/v0.1.0
