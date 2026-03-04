# Template Development Guide

## Overview

This document explains how to create and maintain templates for unoff-cli.

## Template Structure

Templates are located in the `templates/` directory. Each platform has its own subdirectory:

```
templates/
├── figma/          # Figma plugin template
├── penpot/         # Penpot plugin template (coming soon)
├── sketch/         # Sketch plugin template (coming soon)
└── framer/         # Framer plugin template (coming soon)
```

## Template Variables

Templates use [Mustache](https://mustache.github.io/) syntax for variable replacement.

### Available Variables

- `{{ pluginName }}` - The plugin name provided by the user (e.g., "My Awesome Plugin")
- `{{ pluginSlug }}` - Auto-generated slug from pluginName (e.g., "my-awesome-plugin")
- `{{ githubUsername }}` - GitHub username provided by the user

### Usage in Templates

Use double curly braces to insert variables:

**manifest.json**

```json
{
  "name": "{{ pluginName }}",
  "id": "unique-plugin-id",
  "api": "1.0.0"
}
```

**package.json**

```json
{
  "name": "{{ pluginSlug }}",
  "repository": "https://github.com/{{ githubUsername }}/{{ pluginSlug }}"
}
```

**README.md**

```markdown
# {{ pluginName }}

{{ pluginName }} is a Figma plugin that...
```

## File Processing

The CLI automatically processes certain file types:

### Processed Extensions

- `.ts`, `.tsx`, `.js`, `.jsx` - TypeScript/JavaScript files
- `.json` - JSON configuration files
- `.md` - Markdown documentation
- `.html`, `.css` - Web files
- `.yml`, `.yaml` - YAML configuration
- `.txt`, `.xml` - Text files

### Skipped Files/Directories

- `node_modules/` - Always skipped
- `dist/` - Always skipped
- Binary files - Automatically skipped if can't be read as text

## Creating a New Template

### 1. Create Template Directory

```bash
mkdir templates/my-platform
cd templates/my-platform
```

### 2. Initialize Template

Create the basic structure for your platform:

```
my-platform/
├── .github/
│   ├── copilot-instructions.md # GitHub Copilot guidelines
│   └── skills/                # AI skills documentation
│       └── README.md          # Skills index
├── .mcp.json                  # MCP server configuration (optional)
├── .cursorrules               # Cursor AI guidelines
├── .windsurfrules             # Windsurf AI guidelines
├── .clauderules               # Claude (VS Code) guidelines
├── ARCHITECTURE.md            # Architecture documentation
├── manifest.json              # Platform manifest
├── package.json               # NPM dependencies
├── tsconfig.json              # TypeScript config
├── README.md                  # Template README
├── src/
│   ├── index.ts               # Plugin entry point
│   └── ui/                    # UI components
└── dist/                      # Build output (gitignored)
```

### 3. Add Template Variables

Add variables where user input is needed:

```json
{
  "name": "{{ pluginName }}",
  "version": "0.1.0",
  "description": "{{ pluginName }} - A plugin for...",
  "repository": "https://github.com/{{ githubUsername }}/{{ pluginSlug }}"
}
```

### 4. Add Comments for User Customization

Guide users on what to customize:

```markdown
# {{ pluginName }}

<!-- Describe what your plugin does in 2-3 sentences -->

{{ pluginName }} is a plugin that...

<!-- Optional: Add context about why you built this plugin -->
<!-- The idea behind this plugin comes from... -->
```

### 5. Test Your Template

Test the template with the CLI:

```bash
# Build the CLI
npm run build

# Test creating a plugin from your template
node bin/unoff.js create my-platform-plugin --name "Test Plugin"

# Verify the output
cd test-plugin
npm install
npm run build
```

## Template Best Practices

### 1. Use Clear Placeholders

```markdown
<!-- Good: Clear instruction -->
<!-- Describe what your plugin does -->

{{ pluginName }} is a plugin that...

<!-- Bad: No guidance -->

{{ pluginName }}
```

### 2. Provide Default Values

```typescript
// Good: Reasonable defaults
const config = {
  name: '{{ pluginName }}',
  width: 640,
  height: 480
}

// Bad: Everything templated
const config = {
  name: '{{ pluginName }}',
  width: {{ pluginWidth }},
  height: {{ pluginHeight }}
}
```

### 3. Include Documentation

Each template should include:

- `ARCHITECTURE.md` with architecture overview
- `README.md` with setup instructions
- `.github/skills/` directory with AI skills documentation
- AI configuration files (`.cursorrules`, `.windsurfrules`, `.clauderules`, `.github/copilot-instructions.md`)
- `.mcp.json` for MCP server configuration (if applicable)
- Comments in code explaining key patterns
- Example `.env` file (with placeholder values)

### 4. Keep Dependencies Updated

Regularly update template dependencies:

```bash
cd templates/figma
npm update
npm audit fix
```

## Template Testing

### Manual Testing

```bash
# Create test plugin
npm run build
node bin/unoff.js create figma-plugin --name "Test Plugin"

# Test the generated plugin
cd test-plugin
npm install
npm run build
```

### Automated Testing (Future)

We plan to add automated template testing:

```bash
npm test -- --template=figma
```

## Contributing Templates

To contribute a new template:

1. Fork the repository
2. Create your template in `templates/your-platform/`
3. Update CLI to support new platform in `src/cli.ts`
4. Test thoroughly
5. Submit a Pull Request

### PR Checklist

- [ ] Template follows structure guidelines
- [ ] All variables are properly documented
- [ ] Template builds without errors
- [ ] README.md is complete
- [ ] package.json has correct dependencies
- [ ] No sensitive data in template (API keys, tokens, etc.)

## Maintenance

### Updating Existing Templates

When updating templates:

1. Test changes with existing plugins
2. Document breaking changes in CHANGELOG.md
3. Bump version number appropriately
4. Consider adding migration guide if breaking

### Versioning

Templates don't have separate versions - they're versioned with the CLI package. Major template changes should trigger CLI version bumps.

## Support

For questions about template development:

- Open an issue on GitHub
- Join our Discord community
- Check existing templates for examples
