# 🔍 ImportLens

**Explainable, safe import cleanup for VS Code using LSP diagnostics.**

ImportLens helps you **understand why an import is unused before removing it**, ensuring safe, confident cleanup. No AI guessing, no risky automation — just transparent, LSP-powered analysis.

---

## ✨ Features

### 🎯 **Multi-Language Support**
Dedicated adapters for **TypeScript, JavaScript, Python, Java, Go, Rust, C/C++** + generic LSP support for 50+ languages.

### 🛡️ **Safe Mode (Default)**
Automatically preserves side-effect imports like CSS files, polyfills, test setup, and database drivers.

### 📊 **Visual Statistics Dashboard**
Interactive dashboard with:
- Real-time charts (by language, confidence level)
- Import usage heatmap showing top files
- Comprehensive metrics and insights
- Exportable data and refresh capabilities

### 💡 **Explainable Results**
Hover over any unused import to see:
- **Why** it's unused (never referenced, shadowed, type-only, etc.)
- **Source** (TypeScript LSP, Pylance, gopls, clangd, etc.)
- **Side effects** detected
- **Safety rating** (safe to remove vs. aggressive mode only)

### 🔄 **Visual Diff Preview**
See before/after changes in a **side-by-side diff view** before applying.

### ⚡ **Performance Optimized**
500ms debouncing, 5-second caching, and cancellable operations for large workspaces.

---

## 🚀 Quick Start

### Install
```bash
ext install DEADSERPENT.importlens
```

### Usage

**Command Palette** (`Ctrl+Shift+P`):
- `ImportLens: Clean Current File`
- `ImportLens: Clean Workspace`
- `ImportLens: Show Import Statistics`
- `ImportLens: Toggle Safe Mode`

**Context Menu**:
- Right-click in editor → Clean Current File
- Right-click in Explorer → Clean Workspace

**Auto-Clean on Save**:
Enable: `importlens.enableOnSave`

---

## ⚙️ Configuration

```json
{
  "importlens.enableOnSave": false,
  "importlens.showExplanationTooltip": true,
  "importlens.safeMode": true,
  "importlens.aggressiveMode": false,
  "importlens.showDiffBeforeApply": true,
  "importlens.excludedLanguages": ["markdown", "plaintext"],
  "importlens.excludePatterns": ["**/node_modules/**", "**/dist/**"]
}
```

---

## 🌍 Language Support

| Language | Adapter | Import Patterns | Side-Effect Detection |
|----------|---------|-----------------|----------------------|
| **TypeScript/JavaScript** | ✅ Full | ES6, CommonJS, Type-only | CSS, polyfills, env |
| **Python** | ✅ Full | `import`, `from...import` | `__future__`, matplotlib |
| **Java** | ✅ Full | Regular, static, star | JUnit, Mockito |
| **Go** | ✅ Full | Single, grouped, blank | Database drivers |
| **Rust** | ✅ Full | `use`, grouped, glob | Macros, prelude |
| **C/C++** | ✅ Full | `#include <>`, `#include ""` | iostream, test frameworks |
| **50+ Others** | ✅ Generic | Keyword detection | Conservative |

---

## 🎓 How It Works

1. **LSP Diagnostics** — Listens to language server's "unused import" diagnostics
2. **Smart Analysis** — Language-specific adapters parse imports and detect side effects
3. **Confidence Scoring** — Each import gets a confidence score (0-100%)
4. **Safe Filtering** — Preserves imports with potential side effects
5. **User Approval** — Shows diff preview before removal

---

## 📋 Examples

### TypeScript/JavaScript
**Before:**
```typescript
import React from 'react';           // Used
import { useState, useEffect } from 'react';  // Unused
import './styles.css';               // Side-effect
```

**After (Safe Mode):**
```typescript
import React from 'react';
import './styles.css';
```

### Python
**Before:**
```python
from __future__ import annotations   # Side-effect
import os                             # Unused
import matplotlib.pyplot as plt       # Side-effect
```

**After (Safe Mode):**
```python
from __future__ import annotations
import matplotlib.pyplot as plt
```

### Go
**Before:**
```go
import "fmt"                          // Used
import _ "database/sql/driver"        // Blank import
import "unused/package"               // Unused
```

**After (Safe Mode):**
```go
import "fmt"
import _ "database/sql/driver"
```

---

## 🆚 Why ImportLens?

| Feature | ImportLens | Others |
|---------|-----------|--------|
| **Multi-language** | ✅ 7 dedicated + 50 generic | ❌ TS/JS only |
| **Explainable** | ✅ Shows why unused | ❌ Silent |
| **Visual dashboard** | ✅ Charts + heatmap | ❌ No |
| **Side-effect detection** | ✅ Language-aware | ⚠️ Basic |
| **Diff preview** | ✅ Visual | ❌ No |
| **Cancellable** | ✅ Yes | ❌ No |

---

## 🤝 Contributing

Contributions welcome! Fork, branch, commit, push, PR.

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

Built using VS Code Extension API, LSP, TypeScript, Pylance, gopls, and rust-analyzer.

---

**Developed by DEADSERPENT**
