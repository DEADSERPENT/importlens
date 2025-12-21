![ImportLens Logo](header.png)

[![NPM](https://img.shields.io/npm/v/importlens?color=CB3837&logo=npm)](https://www.npmjs.com/package/importlens)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/SAMARTHASMG14.importlens?logo=visualstudiocode&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=SAMARTHASMG14.importlens)

**Clean unused imports across multiple languages in VS Code and CI/CD.**

Detects and removes unused imports using AST analysis for TypeScript/JavaScript and LSP for other languages. Features symbol-level precision, baseline tracking, and historical trend visualization.

## Features

**Multi-Language Support** • **Safe Mode** • **Symbol-Level Precision** • **Baseline Tracking** • **Historical Trends** • **Visual Dashboard**

**Supported Languages:**

🟦 **TypeScript/JavaScript** • 🐍 **Python** • ☕ **Java** • 🔵 **Go** • 🦀 **Rust** • ⚙️ **C/C++**

*Plus 50+ additional languages via Language Server Protocol (LSP) support*

## Installation

**VS Code:** Extensions → Search "ImportLens" → Install

**CLI:** `npm install -g importlens`

## Usage

### VS Code Extension

```
Ctrl+Shift+P → ImportLens: Clean Current File
```

### CLI Tool

```bash
# Check for unused imports
importlens-cli --check src/

# Auto-fix with safe mode
importlens-cli --fix --safe-mode src/

# Baseline workflow (CI/CD)
importlens-cli --baseline-generate src/
importlens-cli --check src/
importlens-cli --baseline-update src/
```

## Example

```typescript
// Before
import React from 'react';
import { useState, useEffect } from 'react';
import './styles.css';

// After (Safe Mode)
import React from 'react';
import './styles.css';
```

## CI/CD Integration

**GitHub Actions:**
```yaml
- name: Check unused imports
  run: |
    npm install -g importlens
    importlens-cli --check --format=github src/
```

**Output Formats:** `text` • `json` • `github` • `junit`

## Configuration

**VS Code:** `settings.json`
```json
{
  "importlens.enableOnSave": true,
  "importlens.safeMode": true,
  "importlens.showStatusBar": true
}
```

**CLI:** `.importlensrc.json` in project root

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Complete usage instructions
- **[Architecture](docs/ARCHITECTURE.md)** - Technical design
- **[Vision](docs/VISION.md)** - Project roadmap
- **[Contributing](CONTRIBUTING.md)** - Development guide

## License

MIT © 2025 ImportLens Contributors

**Links:** [GitHub](https://github.com/DEADSERPENT/importlens) • [Issues](https://github.com/DEADSERPENT/importlens/issues) • [NPM](https://www.npmjs.com/package/importlens) • [VSCODE](https://marketplace.visualstudio.com/items?itemName=SAMARTHASMG14.importlens)
