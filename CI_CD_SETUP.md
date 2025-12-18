# ImportLens CI/CD Integration Guide

ImportLens now supports headless CLI execution for seamless integration into your CI/CD pipelines, pre-commit hooks, and automated workflows.

## Table of Contents

- [CLI Installation](#cli-installation)
- [Command-Line Usage](#command-line-usage)
- [GitHub Actions Integration](#github-actions-integration)
- [Pre-commit Hooks](#pre-commit-hooks)
- [GitLab CI/CD](#gitlab-cicd)
- [Jenkins Integration](#jenkins-integration)
- [Configuration](#configuration)
- [Output Formats](#output-formats)

---

## CLI Installation

### Global Installation (Recommended for CI/CD)

```bash
npm install -g importlens
```

### Local Project Installation

```bash
npm install --save-dev importlens
```

### Verify Installation

```bash
importlens-cli --version
```

---

## Command-Line Usage

### Basic Commands

#### Check for Unused Imports (Check Mode)

```bash
# Check current directory
importlens-cli --check .

# Check specific files/patterns
importlens-cli --check src/**/*.ts

# Check with specific format
importlens-cli --check --format=json src/
```

#### Automatically Fix Unused Imports

```bash
# Fix with safe mode (preserves side-effect imports)
importlens-cli --fix --safe-mode src/

# Aggressive mode (removes all unused imports)
importlens-cli --fix --aggressive src/
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--check` | Check for unused imports without fixing | `true` if neither --check nor --fix |
| `--fix` | Automatically remove unused imports | `false` |
| `--safe-mode` | Preserve side-effect imports (recommended) | `true` |
| `--aggressive` | Remove all unused imports including side-effects | `false` |
| `--format=<type>` | Output format: `text`, `json`, `github`, `junit` | `text` |
| `--config=<file>` | Path to configuration file | Auto-detect `.importlensrc.json` |
| `--exclude=<pattern>` | Glob pattern to exclude files (repeatable) | See defaults |
| `--help`, `-h` | Show help message | - |
| `--version`, `-v` | Show version information | - |

### Exit Codes

- **0**: Success (no unused imports or successfully fixed)
- **1**: Failure (unused imports found in check mode or error occurred)

---

## GitHub Actions Integration

### Quick Setup

1. Copy the workflow template to your repository:

```bash
mkdir -p .github/workflows
cp node_modules/importlens/.github/workflows/importlens.yml .github/workflows/
```

2. Commit and push:

```bash
git add .github/workflows/importlens.yml
git commit -m "Add ImportLens CI check"
git push
```

### Manual Setup

Create `.github/workflows/importlens.yml`:

```yaml
name: ImportLens Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  check-imports:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install ImportLens
        run: npm install -g importlens

      - name: Check for unused imports
        run: importlens-cli --check --format=github src/
```

### With PR Comments

Add this step to comment on PRs with results:

```yaml
      - name: Generate Report
        if: always()
        run: importlens-cli --check --format=json src/ > report.json

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('report.json', 'utf8'));

            if (report.totalUnusedImports > 0) {
              const comment = `## ⚠️ ImportLens Found Issues

              **${report.totalUnusedImports} unused import(s)** in **${report.filesWithIssues} file(s)**

              Please clean up unused imports before merging.`;

              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
```

---

## Pre-commit Hooks

ImportLens supports two types of pre-commit integration:

### Option 1: Simple Git Hook

Install the basic Git hook:

```bash
npm run setup:hooks
```

Or manually copy the hook:

```bash
cp templates/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Option 2: Pre-commit Framework (Recommended)

If you use [pre-commit](https://pre-commit.com/):

1. Install pre-commit:
   ```bash
   pip install pre-commit
   ```

2. Set up ImportLens hook:
   ```bash
   npm run setup:precommit
   ```

3. Install the hooks:
   ```bash
   pre-commit install
   ```

4. Your `.pre-commit-config.yaml` should contain:
   ```yaml
   repos:
     - repo: local
       hooks:
         - id: importlens
           name: ImportLens - Check Unused Imports
           entry: npx importlens-cli --check
           language: system
           types_or: [javascript, jsx, ts, tsx, python, java, go, rust, c, c++]
   ```

### Bypass Pre-commit Hook

If you need to bypass the check (not recommended):

```bash
git commit --no-verify
```

---

## GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test

importlens:
  stage: test
  image: node:20
  before_script:
    - npm install -g importlens
  script:
    - importlens-cli --check --format=text src/
  allow_failure: false
  only:
    - merge_requests
    - main
    - develop
```

---

## Jenkins Integration

Add to your `Jenkinsfile`:

```groovy
pipeline {
  agent any

  stages {
    stage('Check Imports') {
      steps {
        script {
          sh 'npm install -g importlens'
          sh 'importlens-cli --check --format=junit src/ > importlens-report.xml'
        }
      }
      post {
        always {
          junit 'importlens-report.xml'
        }
      }
    }
  }
}
```

---

## Configuration

### Configuration File

Create `.importlensrc.json` in your project root:

```json
{
  "safeMode": true,
  "aggressiveMode": false,
  "excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/out/**",
    "**/*.min.js",
    "**/__tests__/**",
    "**/*.test.ts"
  ],
  "excludedLanguages": [
    "markdown",
    "plaintext",
    "json"
  ]
}
```

### Configuration Precedence

Configuration is loaded in this order (later overrides earlier):

1. Default settings
2. `.importlensrc.json` in project root or parent directories
3. `--config=<file>` command-line option
4. Individual command-line flags (`--safe-mode`, `--aggressive`, etc.)

---

## Output Formats

### Text Format (Default)

Human-readable output for terminal:

```
ImportLens Analysis Results
===========================

⚠️  src/utils/helpers.ts
   Found 2 unused import(s):

   Line 3: import { debounce, throttle } from 'lodash'
   → Symbol(s) throttle not used in code

   Line 5: import axios from 'axios'
   → Symbol(s) axios not used in code
```

### JSON Format

Structured data for programmatic processing:

```json
{
  "totalFiles": 15,
  "filesWithIssues": 3,
  "totalUnusedImports": 5,
  "results": [
    {
      "filePath": "src/utils/helpers.ts",
      "language": "typescript",
      "unusedImportCount": 2,
      "unusedImports": [...]
    }
  ]
}
```

Usage:
```bash
importlens-cli --check --format=json src/ > report.json
```

### GitHub Format

GitHub Actions annotations:

```
::warning file=src/utils/helpers.ts,line=3::Unused import: throttle - Symbol(s) throttle not used in code
::notice::Found 5 unused import(s) in 3 file(s)
```

Usage:
```bash
importlens-cli --check --format=github src/
```

### JUnit Format

XML format compatible with CI systems:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="ImportLens" tests="15" failures="3">
  <testsuite name="Unused Import Detection">
    <testcase name="src/utils/helpers.ts" status="failure">
      <failure message="Found 2 unused import(s)">
        Line 3: import { debounce, throttle } from 'lodash'
        → Symbol(s) throttle not used in code
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

Usage:
```bash
importlens-cli --check --format=junit src/ > junit-report.xml
```

---

## Examples

### Check TypeScript Project

```bash
importlens-cli --check src/**/*.ts
```

### Fix Python Project

```bash
importlens-cli --fix --safe-mode **/*.py
```

### Check with Custom Config

```bash
importlens-cli --check --config=.importlens-ci.json src/
```

### Exclude Specific Directories

```bash
importlens-cli --check \
  --exclude="**/tests/**" \
  --exclude="**/mocks/**" \
  src/
```

### Generate Report for Multiple Formats

```bash
# Human-readable
importlens-cli --check --format=text src/ > report.txt

# JSON for processing
importlens-cli --check --format=json src/ > report.json

# GitHub annotations
importlens-cli --check --format=github src/
```

---

## Troubleshooting

### CLI Not Found

If `importlens-cli` is not found after installation:

```bash
# Check installation
npm list -g importlens

# Try with npx
npx importlens-cli --version

# Reinstall
npm install -g importlens
```

### Permission Denied (Pre-commit Hook)

```bash
chmod +x .git/hooks/pre-commit
```

### False Positives

If ImportLens reports false positives (imports that are actually used):

1. Check if the import is used in comments, strings, or type annotations
2. Consider using `--safe-mode` to preserve potential side-effect imports
3. Exclude specific files/patterns using `--exclude` or configuration file
4. Report the issue on GitHub with a minimal reproducible example

---

## Support

- **Documentation**: [https://github.com/DEADSERPENT/importlens](https://github.com/DEADSERPENT/importlens)
- **Issues**: [https://github.com/DEADSERPENT/importlens/issues](https://github.com/DEADSERPENT/importlens/issues)
- **Discussions**: [https://github.com/DEADSERPENT/importlens/discussions](https://github.com/DEADSERPENT/importlens/discussions)

---

## License

MIT License - See [LICENSE](LICENSE) file for details.
