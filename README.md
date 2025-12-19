# 🔍 ImportLens

**Clean unused imports safely across 7+ languages in VS Code and CI/CD.**

ImportLens detects and removes unused imports with LSP-powered analysis, visual explanations, and symbol-level precision. Works in both VS Code editor and command-line for automation.

---

## ✨ Features

**Multi-Language** • **Safe Mode** • **Explainable Results** • **Symbol-Level Precision** • **Visual Dashboard** • **Status Bar** • **CLI Tool** • **Diff Preview** • **Fast Performance**

Supports TypeScript/JS, Python, Java, Go, Rust, C/C++ + 50+ languages via generic LSP adapter.

## 🚀 Installation

**VS Code:** Extensions → Search "ImportLens" → Install
**CLI (Optional):** `npm install -g importlens`

## 📖 Usage

### VS Code

**Commands** (`Ctrl+Shift+P`):
- `ImportLens: Clean Current File` - Remove unused imports from active file
- `ImportLens: Clean Workspace` - Clean all files in workspace
- `ImportLens: Show Import Statistics` - View dashboard with charts
- `ImportLens: Toggle Safe Mode` - Switch safe/aggressive cleanup

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

**GitHub Actions:**
```yaml
- name: Check unused imports
  run: |
    npm install -g importlens
    importlens-cli --check --format=github src/
```

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
**Version**: 1.1.1
