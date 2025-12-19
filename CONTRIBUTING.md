Here is the **final compact CONTRIBUTING.md** in clean Markdown — ready to paste directly into your repository:

---

# Contributing to ImportLens

Thank you for your interest in contributing! This guide provides a quick and lightweight overview to help you get started.

## 📋 Table of Contents

* [Code of Conduct](#code-of-conduct)
* [Getting Started](#getting-started)
* [Development Setup](#development-setup)
* [Project Structure](#project-structure)
* [Making Changes](#making-changes)
* [Testing](#testing)
* [Submitting Changes](#submitting-changes)

---

## Code of Conduct

Please be respectful, constructive, and professional in all interactions.

---

## Getting Started

### Prerequisites

* Node.js 16+
* VS Code
* Git

### Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/importlens.git
cd importlens
git remote add upstream https://github.com/DEADSERPENT/importlens.git
```

---

## Development Setup

```bash
npm install
npm run compile
npm run watch   # Auto-compile on save
```

### Test the Extension

1. Open project in VS Code
2. Press **F5** to launch the Extension Development Host

### Test the CLI

```bash
node ./out/src/cli.js --help
node ./out/src/cli.js --check test-samples/
```

---

## Project Structure

```
src/               # Source code
  adapters/        # Language-specific logic
  cli/             # CLI tool
  core/            # Core engine
  ui/              # UI components
docs/              # Documentation
templates/         # User templates
test/              # Test files
```

More details: `docs/PROJECT_STRUCTURE.md`.

---

## Making Changes

### Branch Naming

Use descriptive names:

* `feature/add-python-support`
* `bugfix/fix-multiline-imports`
* `docs/update-readme`

### Coding Guidelines

* TypeScript strict mode
* Follow existing patterns
* Run `npm run lint`
* Add comments where needed

### Adding Language Support

Implement a new adapter in `src/adapters/`:

```ts
export class NewLanguageAdapter implements LanguageAdapter {
  canHandle(...) { ... }
  isImportStatement(...) { ... }
  parseImport(...) { ... }
  hasSideEffects(...) { ... }
  getExplanation(...) { ... }
}
```

Register it in `LanguageAdapter.ts`, update CLI support, and document it.

---

## Testing

### Manual Testing

```bash
npm run compile
node ./out/src/cli.js --check test-samples/
```

Run the extension via **F5** in VS Code.

Add sample files under `test-samples/` when required.

---

## Submitting Changes

### Before Submitting

* Compile: `npm run compile`
* Lint: `npm run lint`
* Test your changes
* Update relevant docs (README, CHANGELOG, etc.)

### Pull Request Flow

```bash
git fetch upstream
git rebase upstream/main
git add .
git commit -m "feat: add new language support"
git push origin your-branch
```

Open a PR on GitHub, fill the template, and link related issues.

---

## Useful Commands

```bash
npm run compile
npm run watch
npm run lint
npm run cli -- --help
npm run package:vscode
```

---

## Debugging

### Extension Debugging

* Set breakpoints
* Press **F5**
* A second VS Code window opens for testing

### CLI Debugging

```bash
node --inspect ./out/src/cli.js --check test-samples/
```

Open `chrome://inspect` in Chrome and attach to the process.

---

## Need Help?

* GitHub Issues
* GitHub Discussions
* Documentation in `/docs`

---

**Thanks for contributing to ImportLens! 🚀**
