![ImportLens Logo](header.png)

[![NPM](https://img.shields.io/npm/v/importlens?color=CB3837&logo=npm)](https://www.npmjs.com/package/importlens)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/SAMARTHASMG14.importlens?logo=visualstudiocode&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=SAMARTHASMG14.importlens)

> Intelligent import management for VS Code and CI/CD pipelines — detect, remove, and organize unused imports with AST-level precision across six languages.

## Supported Languages

| Language | Detection | Organize Imports |
|---|---|---|
| TypeScript / JavaScript | Babel AST | Yes |
| Python | Tree-sitter / regex | Yes — PEP 8 groups |
| Java | Tree-sitter / regex | Yes — package groups |
| Go | Tree-sitter / regex | Yes — stdlib / third-party |
| Rust | Tree-sitter / regex | — |
| C / C++ | Heuristic | — |
| 50+ others | LSP | — |

## Installation

**VS Code** — Extensions panel → search **ImportLens** → Install

**CLI**
```bash
npm install -g importlens
```

**Enable Tree-sitter (optional, recommended for Python/Java/Go/Rust)**
```bash
npm install --save-optional tree-sitter tree-sitter-python tree-sitter-java tree-sitter-go tree-sitter-rust
```

## VS Code Commands

Open the Command Palette (`Ctrl+Shift+P`) and type **ImportLens**:

- **Clean Current File** — remove unused imports from the active editor
- **Clean Workspace** — remove unused imports across all open files
- **Organize Imports** — sort and group imports by language convention
- **Show Team Dashboard** — workspace health metrics with git contributor data
- **Show Import Statistics** — historical trend charts
- **Toggle Safe Mode** — preserve or allow removal of side-effect imports

## CLI

```bash
# Detect unused imports
importlens-cli --check src/

# Auto-fix (safe mode preserves side-effect imports)
importlens-cli --fix --safe-mode src/

# CI/CD — annotate GitHub Actions with inline warnings
importlens-cli --check --format=github src/

# Baseline workflow — track debt without blocking the pipeline
importlens-cli --baseline-generate src/
importlens-cli --baseline-check src/

# Team analytics report
importlens-cli --analytics --analytics-output=report.json src/
```

Output formats: `text` · `json` · `github` · `junit`

The CLI automatically distributes work across CPU cores using worker threads for faster analysis in large monorepos.

## CI/CD

```yaml
- name: ImportLens — check unused imports
  run: |
    npm install -g importlens
    importlens-cli --check --format=github src/
```

## Configuration

```json
{
  "importlens.safeMode": true,
  "importlens.enableOnSave": false,
  "importlens.excludePatterns": ["**/node_modules/**", "**/dist/**"]
}
```

## Documentation

[User Guide](docs/USER_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

---

MIT License · [GitHub](https://github.com/DEADSERPENT/importlens) · [NPM](https://www.npmjs.com/package/importlens) · [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SAMARTHASMG14.importlens)
