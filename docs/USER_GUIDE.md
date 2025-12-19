# ImportLens User Guide

Complete guide for using ImportLens in VS Code and via CLI.

## Table of Contents

- [VS Code Extension](#vs-code-extension)
- [CLI Tool (npm)](#cli-tool-npm)
- [Configuration](#configuration)
- [Examples](#examples)

---

## VS Code Extension

### Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+P)
3. Search for "ImportLens"
4. Click Install

### Features

#### Real-Time Detection
- Unused imports are automatically highlighted with strikethrough
- Hover over highlighted imports to see why they're unused
- Status bar shows live count of unused imports

#### Commands

Access via Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

- **ImportLens: Clean Current File** - Remove unused imports from active file
- **ImportLens: Clean Workspace** - Clean all files in workspace
- **ImportLens: Show Import Statistics** - View dashboard with charts
- **ImportLens: Toggle Safe Mode** - Switch between safe/aggressive cleanup

#### Context Menu

Right-click in editor:
- **ImportLens: Clean Current File** - Quick cleanup option

#### Status Bar

Bottom-right corner shows:
- `✓ Imports Clean` - No issues
- `🗑 3 unused imports` - Click to clean

### Usage Examples

#### Clean a Single File

**Method 1: Command Palette**
```
1. Open file with unused imports
2. Ctrl+Shift+P → "ImportLens: Clean Current File"
3. Review diff preview
4. Confirm changes
```

**Method 2: Status Bar**
```
1. Open file with unused imports
2. Click status bar item showing count
3. Review diff and confirm
```

**Method 3: Context Menu**
```
1. Right-click in editor
2. Select "ImportLens: Clean Current File"
```

#### Clean Entire Workspace

```
1. Ctrl+Shift+P → "ImportLens: Clean Workspace"
2. Wait for progress notification
3. See summary of cleaned files
```

#### View Statistics

```
1. Ctrl+Shift+P → "ImportLens: Show Import Statistics"
2. View dashboard with:
   - Total unused imports by language
   - Files with most issues
   - Visual charts and graphs
```

### Settings

Access via Settings (Ctrl+, / Cmd+,) → Search "ImportLens"

#### Enable Auto-Cleanup on Save
```json
"importlens.enableOnSave": true
```
Automatically removes unused imports when you save files.

#### Show Tooltips
```json
"importlens.showExplanationTooltip": true
```
Display explanations when hovering over unused imports.

#### Show Status Bar
```json
"importlens.showStatusBar": true
```
Show/hide the status bar counter.

#### Safe Mode (Recommended)
```json
"importlens.safeMode": true
```
Preserves side-effect imports like:
```typescript
import './styles.css'
import 'reflect-metadata'
```

#### Aggressive Mode
```json
"importlens.aggressiveMode": true
```
Removes ALL unused imports including potential side-effects.

#### Show Diff Preview
```json
"importlens.showDiffBeforeApply": true
```
Preview changes before applying.

#### Exclude Languages
```json
"importlens.excludedLanguages": ["markdown", "plaintext"]
```

#### Exclude File Patterns
```json
"importlens.excludePatterns": [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.min.js"
]
```

---

## CLI Tool (npm)

### Installation

#### Global (Recommended for CI/CD)
```bash
npm install -g importlens
```

#### Local Project
```bash
npm install --save-dev importlens
```

#### Verify Installation
```bash
importlens-cli --version
```

### Basic Usage

#### Check for Unused Imports
```bash
# Check current directory
importlens-cli --check .

# Check specific directory
importlens-cli --check src/

# Check specific files
importlens-cli --check src/index.ts src/app.ts
```

#### Auto-Fix Unused Imports
```bash
# Fix with safe mode (preserves side-effects)
importlens-cli --fix --safe-mode src/

# Aggressive fix (removes everything)
importlens-cli --fix --aggressive src/
```

### Output Formats

#### Human-Readable Text (Default)
```bash
importlens-cli --check src/
```
Output:
```
ImportLens Analysis Results
===========================

⚠️  src/utils/helpers.ts
   Found 2 unused import(s):
   Line 3: import { debounce, throttle } from 'lodash'
   → Symbol(s) throttle not used in code
```

#### JSON (For Processing)
```bash
importlens-cli --check --format=json src/ > report.json
```
Output:
```json
{
  "totalFiles": 15,
  "filesWithIssues": 3,
  "totalUnusedImports": 5,
  "results": [...]
}
```

#### GitHub Actions Annotations
```bash
importlens-cli --check --format=github src/
```
Output:
```
::warning file=src/utils/helpers.ts,line=3::Unused import: throttle
```

#### JUnit XML (For Jenkins/CI)
```bash
importlens-cli --check --format=junit src/ > junit-report.xml
```

### CLI Options

```
OPTIONS:
  --check              Check without fixing (exit 1 if found)
  --fix                Automatically fix unused imports
  --safe-mode          Preserve side-effect imports (default)
  --aggressive         Remove all unused imports
  --format=<type>      Output format: text, json, github, junit
  --config=<file>      Path to config file (.importlensrc.json)
  --exclude=<pattern>  Exclude files (can use multiple times)
  --help               Show help
  --version            Show version
```

### Configuration File

Create `.importlensrc.json` in project root:

```json
{
  "safeMode": true,
  "aggressiveMode": false,
  "excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.ts"
  ],
  "excludedLanguages": ["markdown", "json"]
}
```

CLI arguments override config file settings.

---

## Configuration

### VS Code Settings File

**settings.json:**
```json
{
  "importlens.enableOnSave": false,
  "importlens.showExplanationTooltip": true,
  "importlens.showStatusBar": true,
  "importlens.safeMode": true,
  "importlens.aggressiveMode": false,
  "importlens.showDiffBeforeApply": true,
  "importlens.excludedLanguages": ["markdown"],
  "importlens.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**"
  ]
}
```

### CLI Config File

**.importlensrc.json:**
```json
{
  "safeMode": true,
  "excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**"
  ],
  "excludedLanguages": ["markdown", "plaintext"]
}
```

---

## Examples

### Example 1: Clean TypeScript Project

**VS Code:**
```
1. Open project
2. Ctrl+Shift+P → "ImportLens: Clean Workspace"
3. Review statistics dashboard
```

**CLI:**
```bash
importlens-cli --fix --safe-mode src/**/*.ts
```

### Example 2: CI/CD Check

**GitHub Actions:**
```yaml
- name: Check imports
  run: importlens-cli --check --format=github src/
```

**GitLab CI:**
```yaml
importlens:
  script:
    - importlens-cli --check --format=junit src/ > report.xml
  artifacts:
    reports:
      junit: report.xml
```

### Example 3: Pre-commit Hook

**Install hook:**
```bash
npm run setup:hooks
```

Now every commit checks for unused imports automatically.

### Example 4: Python Project

**VS Code:**
```
1. Open .py file
2. See unused imports highlighted
3. Click status bar to clean
```

**CLI:**
```bash
importlens-cli --check --format=text **/*.py
```

### Example 5: Multi-Language Project

**VS Code:**
Automatically works for all supported languages.

**CLI:**
```bash
# Check all supported files
importlens-cli --check src/

# Specific languages
importlens-cli --check src/**/*.{ts,py,java,go,rs}
```

---

## Supported Languages

- TypeScript/JavaScript (.ts, .tsx, .js, .jsx)
- Python (.py)
- Java (.java)
- Go (.go)
- Rust (.rs)
- C/C++ (.c, .cpp, .h, .hpp)

---

## Troubleshooting

### VS Code Extension Not Working

1. Check language is supported
2. Verify file isn't excluded in settings
3. Restart VS Code
4. Check Output panel: View → Output → ImportLens

### CLI Not Found After Install

```bash
# Check installation
npm list -g importlens

# Reinstall
npm install -g importlens

# Use with npx
npx importlens-cli --help
```

### False Positives

If ImportLens reports imports that ARE used:

1. **VS Code**: Use safe mode (preserves potential side-effects)
2. **CLI**: Use `--safe-mode` flag
3. **Report Issue**: Create GitHub issue with example

### Performance Issues

For large workspaces:

1. Exclude build directories in settings
2. Use workspace exclude patterns
3. Run on specific directories instead of entire workspace

---

## Getting Help

- **Documentation**: [GitHub README](https://github.com/DEADSERPENT/importlens)
- **Issues**: [GitHub Issues](https://github.com/DEADSERPENT/importlens/issues)
- **VS Code**: Command Palette → "ImportLens: Show Help"

---

## Quick Reference

### VS Code Keyboard Shortcuts

Add to keybindings.json:
```json
{
  "key": "ctrl+shift+i",
  "command": "importlens.cleanFile"
}
```

### CLI Quick Commands

```bash
# Check
importlens-cli --check src/

# Fix
importlens-cli --fix src/

# JSON report
importlens-cli --check --format=json src/ > report.json

# Help
importlens-cli --help
```
