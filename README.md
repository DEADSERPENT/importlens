# 🔍 ImportLens

**Clean unused imports safely across 7+ languages in VS Code and CI/CD.**

ImportLens detects and removes unused imports with AST-powered analysis for TypeScript/JavaScript and LSP-based detection for other languages. Features include visual explanations, symbol-level precision, import organization, Quick Fixes, and baseline tracking for CI/CD.

---

## ✨ Features

### **New in v2.0.0**
- **🎯 AST-Based Analysis** - 100% accurate TypeScript/JavaScript import detection using Babel
- **📦 Import Organization** - Sort, group, and deduplicate imports automatically
- **⚡ Quick Fix Actions** - One-click removal of unused imports in VS Code
- **📊 Baseline Tracking** - Track technical debt and prevent NEW unused imports in CI/CD

### **Core Features**
**Multi-Language** • **Safe Mode** • **Explainable Results** • **Symbol-Level Precision** • **Visual Dashboard** • **Status Bar** • **CLI Tool** • **Diff Preview** • **Fast Performance**

Supports TypeScript/JS (AST-based), Python, Java, Go, Rust, C/C++ + 50+ languages via LSP adapter.

## 🚀 Installation

**VS Code:** Extensions → Search "ImportLens" → Install
**CLI (Optional):** `npm install -g importlens`

## 📖 Usage

### VS Code

**Commands** (`Ctrl+Shift+P`):
- `ImportLens: Clean Current File` - Remove unused imports from active file
- `ImportLens: Clean Workspace` - Clean all files in workspace
- `ImportLens: Organize Imports` - Sort, group, and deduplicate imports (TS/JS)
- `ImportLens: Show Import Statistics` - View dashboard with charts
- `ImportLens: Toggle Safe Mode` - Switch safe/aggressive cleanup

**Quick Fixes**:
- Hover over unused imports and click the lightbulb for Quick Fix actions
- Remove individual symbols or entire imports
- Batch remove all unused imports in a file

**Status Bar**:
- Click the import count in status bar to clean current file
- Shows: `✓ Imports Clean` or `🗑 3 unused imports`

**Auto-Clean on Save**:
```json
{
  "importlens.enableOnSave": true
}
```

### CLI Tool

**Check for unused imports:**
```bash
importlens-cli --check src/
```

**Auto-fix with safe mode:**
```bash
importlens-cli --fix --safe-mode src/
```

**Baseline workflow for CI/CD:**
```bash
# 1. Generate baseline (one-time setup)
importlens-cli --baseline-generate src/

# 2. Check for NEW issues beyond baseline
importlens-cli --check src/  # Auto-detects baseline

# 3. Update baseline when accepting new debt
importlens-cli --baseline-update src/
```

**CI/CD with GitHub Actions:**
```bash
importlens-cli --check --format=github src/
```

**Output formats:** `text`, `json`, `github`, `junit`

---

## ⚙️ Configuration

**VS Code Settings:**
- `importlens.enableOnSave` - Auto-clean on save (default: false)
- `importlens.safeMode` - Preserve side-effects (default: true)
- `importlens.showStatusBar` - Show status bar count (default: true)
- `importlens.excludePatterns` - File patterns to exclude

**CLI Config:** Create `.importlensrc.json` with `safeMode`, `excludePatterns`, etc.

---

## 🌍 Language Support

TypeScript/JS • Python • Java • Go • Rust • C/C++ + 50+ via Generic LSP

---

## 📋 Example

```typescript
// Before
import React from 'react';              // Used ✓
import { useState, useEffect } from 'react';  // Unused ✗
import './styles.css';                  // Side-effect ✓

// After (Safe Mode)
import React from 'react';
import './styles.css';                  // Preserved!
```

---

## 🔧 CI/CD Integration

### GitHub Actions

**Option 1: Standard Check** (Copy from `templates/github-action.yml`)
```yaml
- name: Check unused imports
  run: |
    npm install -g importlens
    importlens-cli --check --format=github src/
```

**Option 2: Baseline Mode** (Copy from `templates/github-action-baseline.yml`)
```yaml
- name: Check for new unused imports
  run: |
    npm install -g importlens
    importlens-cli --check --baseline-check src/
```

See the `templates/` directory for complete, ready-to-use GitHub Action workflows with PR commenting, artifact uploads, and more.

**Pre-commit Hook:**
```bash
npm run setup:hooks  # Installs pre-commit hook
```

---

## 📚 Documentation

- **[User Guide](USER_GUIDE.md)** - Detailed usage for VS Code and CLI
- **[Architecture ](ARCHITECTURE.md)** - System design
- **[CI/CD Setup](CI_CD_SETUP.md)** - GitHub Actions, GitLab, Jenkins

---

## 📄 License

MIT © 2025 ImportLens Contributors

---

**Repository**: [github.com/DEADSERPENT/importlens](https://github.com/DEADSERPENT/importlens)
**Issues**: [Report a bug](https://github.com/DEADSERPENT/importlens/issues)
**Version**: 2.0.0
