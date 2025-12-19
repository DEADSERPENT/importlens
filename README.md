![ImportLens Logo](header.png)

**Clean unused imports across 7+ languages in VS Code and CI/CD with AST-powered precision.**

ImportLens detects and removes unused imports using AST analysis for TypeScript/JavaScript and LSP for other languages. Features symbol-level precision, import organization, Quick Fixes, and baseline tracking for CI/CD.

### Core Features
**Multi-Language** • **Safe Mode** • **Symbol-Level Precision** • **Visual Dashboard** • **Status Bar** • **CLI Tool** • **Diff Preview**

**Supported**: TypeScript/JS (AST), Python, Java, Go, Rust, C/C++ + 50+ via LSP adapter

## 🚀 Installation

**VS Code:** Extensions → Search "ImportLens" → Install
**CLI:** `npm install -g importlens`

## 📖 Usage

### VS Code Commands (`Ctrl+Shift+P`)
- `ImportLens: Clean Current File` - Remove unused imports
- `ImportLens: Clean Workspace` - Clean all workspace files
- `ImportLens: Organize Imports` - Sort and deduplicate (TS/JS)
- `ImportLens: Show Import Statistics` - View analytics dashboard

### Quick Fixes
Hover over unused imports → Click lightbulb → Remove symbol or entire import

### CLI Tool

**Check for unused imports:**
```bash
importlens-cli --check src/
```

**Auto-fix with safe mode:**
```bash
importlens-cli --fix --safe-mode src/
```

**Baseline workflow (CI/CD):**
```bash
# Generate baseline (captures existing technical debt)
importlens-cli --baseline-generate src/

# Check for NEW issues only
importlens-cli --check src/

# Update baseline when accepting new debt
importlens-cli --baseline-update src/
```

**Output formats:** `text` • `json` • `github` • `junit`

## ⚙️ Configuration

**VS Code Settings:**
```json
{
  "importlens.enableOnSave": true,
  "importlens.safeMode": true,
  "importlens.showStatusBar": true
}
```

**CLI Config:** Create `.importlensrc.json` with `safeMode`, `excludePatterns`, etc.

## 📋 Example

```typescript
// Before
import React from 'react';
import { useState, useEffect } from 'react';
import './styles.css';

// After (Safe Mode) - preserves side-effects
import React from 'react';
import './styles.css';
```

## 🔧 CI/CD Integration

### GitHub Actions

**Standard Check:**
```yaml
- name: Check unused imports
  run: |
    npm install -g importlens
    importlens-cli --check --format=github src/
```

**Baseline Mode (Incremental Adoption):**
```yaml
- name: Check for new unused imports
  run: |
    npm install -g importlens
    importlens-cli --check src/
```

**Templates:** See `templates/github-action.yml` for complete workflows.

**Pre-commit Hook:** `npm run setup:hooks`

## 🏗️ Architecture

ImportLens uses a dual-engine approach:
- **VS Code Extension:** LSP-based (tsserver, Pylance, etc.) for maximum accuracy
- **CLI Tool:** AST-based for standalone headless operation in CI/CD

## 📚 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Complete usage instructions
- **[Architecture](docs/ARCHITECTURE.md)** - Technical deep-dive
- **[Contributing](CONTRIBUTING.md)** - Development guide
- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Codebase organization

## 📄 License

MIT © 2025 ImportLens Contributors

**Repository:** [github.com/DEADSERPENT/importlens](https://github.com/DEADSERPENT/importlens) • **Issues:** [Report a bug](https://github.com/DEADSERPENT/importlens/issues) • **Version:** 2.0.0
