# ImportLens User Guide

Complete guide for using ImportLens v3.0.0 in VS Code and via CLI.

## Table of Contents

- [VS Code Extension](#vs-code-extension)
- [CLI Tool (npm)](#cli-tool-npm)
- [Baseline Tracking & Historical Trends](#baseline-tracking--historical-trends)
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

## Baseline Tracking & Historical Trends

ImportLens provides powerful baseline tracking and historical trend visualization to help teams manage technical debt over time.

### What is Baseline Tracking?

Baseline tracking allows you to:
- **Capture current state** of unused imports as a reference point
- **Compare new code** against the baseline to catch NEW issues only
- **Track trends over time** with automatic snapshot history
- **Adopt incrementally** without blocking existing deployments

### Basic Baseline Workflow

#### 1. Generate Initial Baseline

Create a baseline file that captures all current unused imports:

```bash
importlens-cli --baseline-generate src/
```

This creates `.importlens-baseline.json` in your project root with:
- All current unused imports (accepted as technical debt)
- Metadata (total files, total unused imports)
- Empty history array (ready for snapshots)

#### 2. Check for New Issues

Run checks that only fail on NEW unused imports:

```bash
importlens-cli --check src/
```

Exit codes:
- `0` - No new issues (existing baseline issues are OK)
- `1` - New unused imports detected beyond baseline

#### 3. Update Baseline

When you intentionally accept new technical debt:

```bash
importlens-cli --baseline-update src/
```

This automatically:
- **Captures snapshot** of current state BEFORE updating
- **Updates baseline** with new entries
- **Adds to history** (maintains rolling 30-snapshot limit)
- **Prunes old snapshots** if history exceeds 30

### Historical Snapshots

Every `--baseline-update` automatically captures a point-in-time snapshot of your technical debt.

#### Snapshot Data Structure

Each snapshot contains:
```json
{
  "timestamp": "2025-12-20T10:30:00.000Z",
  "metadata": {
    "totalFiles": 42,
    "totalUnusedImports": 87
  },
  "version": "1.0.0"
}
```

#### Rolling 30-Snapshot History

- History automatically **prunes** to keep only the last 30 snapshots
- Oldest snapshots are removed first (FIFO)
- Chronological order is maintained
- No manual cleanup required

### Viewing Historical Trends

#### VS Code Statistics Panel

View trend charts showing debt evolution:

```
Ctrl+Shift+P → ImportLens: Show Import Statistics
```

The Statistics Panel displays:
- **Trend Chart** - Dual Y-axis line chart (Chart.js)
  - Left axis: Unused imports count
  - Right axis: Files analyzed count
  - X-axis: Timestamps (formatted as "Dec 20, '25")
- **Current Statistics** - Latest snapshot data
- **Language Distribution** - Bar chart by language
- **Confidence Distribution** - Doughnut chart

#### Empty History State

If no history exists yet, the panel shows:
```
No Historical Data Yet
Run importlens-cli --baseline-update to start tracking trends.
```

### Baseline Migration (v2.0.0 → v3.0.0)

**Automatic Migration:**
- v2.0.0 baselines are automatically detected
- Console message: `> Migrating baseline from v2.0.0 to v3.0.0...`
- Adds `history: []` field (empty initially)
- First `--baseline-update` captures first snapshot

**No Action Required:**
Existing v2.0.0 baseline files work seamlessly. The migration happens automatically on first load.

### CI/CD Integration with Baseline

#### GitHub Actions - Baseline Mode

```yaml
name: Check Unused Imports

on: [pull_request]

jobs:
  importlens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install ImportLens
        run: npm install -g importlens

      - name: Check for new unused imports
        run: importlens-cli --check --format=github src/
```

This workflow:
- Automatically uses `.importlens-baseline.json` if it exists
- Only fails on NEW issues beyond baseline
- Shows GitHub annotations for new problems
- Allows incremental adoption without blocking PRs

#### Updating Baseline in CI

```yaml
- name: Update baseline (on main branch only)
  if: github.ref == 'refs/heads/main'
  run: |
    importlens-cli --baseline-update src/
    git config user.name "GitHub Actions"
    git config user.email "actions@github.com"
    git add .importlens-baseline.json
    git commit -m "chore: update import baseline [skip ci]"
    git push
```

### Baseline File Format (v3.0.0)

**.importlens-baseline.json:**
```json
{
  "version": "3.0.0",
  "createdAt": "2025-12-20T10:00:00.000Z",
  "updatedAt": "2025-12-20T15:30:00.000Z",
  "entries": [
    {
      "filePath": "src/utils/helpers.ts",
      "line": 3,
      "importStatement": "import { debounce, throttle } from 'lodash';",
      "symbols": ["throttle"]
    }
  ],
  "metadata": {
    "totalFiles": 42,
    "totalUnusedImports": 87
  },
  "history": [
    {
      "timestamp": "2025-12-19T14:00:00.000Z",
      "metadata": {
        "totalFiles": 40,
        "totalUnusedImports": 95
      },
      "version": "1.0.0"
    },
    {
      "timestamp": "2025-12-20T10:00:00.000Z",
      "metadata": {
        "totalFiles": 42,
        "totalUnusedImports": 87
      },
      "version": "1.0.0"
    }
  ]
}
```

### CLI Options for Baseline

```
BASELINE OPTIONS:
  --baseline=<file>         Path to baseline file (default: .importlens-baseline.json)
  --baseline-generate       Generate new baseline from current results
  --baseline-update         Update baseline and capture snapshot
  --baseline-check          Explicitly check against baseline
```

### Best Practices

#### 1. Commit Baseline to Git
```bash
git add .importlens-baseline.json
git commit -m "chore: add import baseline"
```

This allows team members to:
- Share the same baseline
- Track baseline changes in PR diffs
- See when technical debt was accepted

#### 2. Regular Updates
```bash
# After cleaning up imports
importlens-cli --baseline-update src/

# View the improvement in Statistics Panel
```

#### 3. CI/CD Strategy
```
Development → Check against baseline (fail on new issues)
Main Branch → Update baseline (accept new debt, capture snapshot)
Statistics Panel → Monitor trends over time
```

#### 4. Team Adoption
```bash
# Step 1: Generate baseline (accept current state)
importlens-cli --baseline-generate src/

# Step 2: Add to CI/CD (prevent new issues)
# (See GitHub Actions example above)

# Step 3: Clean up over time
importlens-cli --fix --safe-mode src/
importlens-cli --baseline-update src/

# Step 4: Track progress in Statistics Panel
```

### Troubleshooting Baseline

#### Baseline Not Found
```bash
# Check if baseline exists
ls -la .importlens-baseline.json

# Generate new baseline
importlens-cli --baseline-generate src/
```

#### Invalid Baseline Format
```
Error: Failed to load baseline: Invalid baseline file format
```

**Solution:**
```bash
# Backup old baseline
mv .importlens-baseline.json .importlens-baseline.json.backup

# Generate fresh baseline
importlens-cli --baseline-generate src/
```

#### History Not Showing in Statistics Panel

**Possible causes:**
1. No snapshots captured yet
   - Solution: Run `importlens-cli --baseline-update src/` at least once
2. Baseline file not in workspace root
   - Solution: Ensure `.importlens-baseline.json` is in the same directory as your workspace root
3. Extension cache issue
   - Solution: Restart VS Code

#### Snapshot Count Exceeds 30

This is normal behavior:
- History automatically prunes to 30 snapshots
- Oldest snapshots are removed first
- No manual action required

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

## 🔍 Technical Architecture: Dual-Engine Analysis

ImportLens utilizes a sophisticated dual-engine approach to ensure maximum accuracy across different environments:

### VS Code Extension (LSP-Based)
The extension leverages the full power of the **Language Server Protocol (LSP)**:
- **Real-time diagnostics** from language servers (`tsserver`, `Pylance`, `rust-analyzer`, etc.)
- **Project-wide context** including type checking and cross-file references
- **100% accuracy** for all supported languages through native LSP integration
- **Minimal overhead** as the language server is already running in VS Code

**Result:** The most accurate detection possible, using the same intelligence that powers VS Code's own error checking.

### CLI Tool (AST-Based for TypeScript/JavaScript)
The CLI uses a standalone **Babel AST Parser** for TypeScript and JavaScript:
- **Headless operation** suitable for CI/CD pipelines without a full IDE
- **Symbol-level precision** detecting which specific imports are unused
- **Zero dependencies** on external language servers
- **Fast analysis** optimized for batch processing

For other languages (Python, Java, Go, Rust, C++), the CLI uses pattern-based detection with safe-mode fallbacks.

**Result:** Accurate standalone analysis without requiring a full development environment.

### When to Use Each

| Scenario | Recommended Tool | Reason |
|----------|------------------|--------|
| **Development workflow** | VS Code Extension | Maximum accuracy via LSP |
| **CI/CD pipelines** | CLI Tool | Headless, fast, no IDE needed |
| **Pre-commit hooks** | CLI Tool | Quick checks before commits |
| **Large refactoring** | VS Code Extension | Interactive fixes with full context |
| **TypeScript/JavaScript only** | Either | Both provide 100% accuracy |
| **Multi-language projects** | VS Code Extension | LSP support for all languages |

### Baseline Tracking & Historical Trends

The CLI's **baseline system** with historical tracking allows incremental adoption and trend visualization:
```bash
# Generate baseline to capture existing technical debt
importlens-cli --baseline-generate src/

# CI/CD checks only fail on NEW unused imports
importlens-cli --check src/

# Update baseline and capture historical snapshot
importlens-cli --baseline-update src/
```

This enables teams to adopt ImportLens without blocking deployments while preventing new technical debt and tracking cleanup progress over time.

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
