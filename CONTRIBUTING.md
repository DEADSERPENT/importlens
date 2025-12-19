# Contributing to ImportLens

Thank you for your interest in contributing to ImportLens! This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

## Code of Conduct

Be respectful, constructive, and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- VS Code (for extension development)
- Git

### Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/importlens.git
cd importlens

# Add upstream remote
git remote add upstream https://github.com/DEADSERPENT/importlens.git
```

## Development Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on save)
npm run watch
```

### Testing the Extension

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test your changes in the new VS Code window

### Testing the CLI

```bash
# Run CLI locally
node ./out/src/cli.js --help

# Test on sample files
node ./out/src/cli.js --check test-samples/
```

## Project Structure

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for detailed information.

**Key directories:**
- `src/` - Source code
  - `adapters/` - Language-specific import handling
  - `cli/` - Command-line tool
  - `core/` - Extension logic
  - `ui/` - User interface components
- `docs/` - Documentation
- `templates/` - User templates
- `test/` - Test files

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-python-support`
- `bugfix/fix-multiline-imports`
- `docs/update-readme`

### Coding Standards

- **TypeScript**: Strict mode enabled
- **Style**: Follow existing code patterns
- **Linting**: Run `npm run lint` before committing
- **Comments**: Document complex logic
- **Naming**: Use clear, descriptive names

### Adding Language Support

To add support for a new language:

1. Create a new adapter in `src/adapters/`:
   ```typescript
   export class NewLanguageAdapter implements LanguageAdapter {
     canHandle(languageId: string): boolean { ... }
     isImportStatement(line: string): boolean { ... }
     parseImport(line: string, lineNumber: number): ImportInfo | null { ... }
     hasSideEffects(importInfo: ImportInfo): boolean { ... }
     getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string { ... }
   }
   ```

2. Register it in `src/adapters/LanguageAdapter.ts`:
   ```typescript
   registry.registerAdapter(new NewLanguageAdapter());
   ```

3. Add CLI support in `src/cli/CLIAnalyzer.ts`

4. Update documentation in README.md

### Adding Features

1. **Design First**: Open an issue to discuss your feature
2. **Small PRs**: Break large features into smaller pull requests
3. **Tests**: Add tests for new functionality (when test suite exists)
4. **Docs**: Update relevant documentation

## Testing

### Manual Testing

```bash
# Compile
npm run compile

# Test CLI
node ./out/src/cli.js --check test-samples/

# Test in VS Code
# Press F5 in VS Code to launch Extension Development Host
```

### Adding Test Samples

Add representative test files to `test-samples/` for your language.

## Submitting Changes

### Before Submitting

1. **Compile**: Ensure no TypeScript errors
   ```bash
   npm run compile
   ```

2. **Lint**: Fix any linting issues
   ```bash
   npm run lint
   ```

3. **Test**: Verify your changes work
   - Run CLI on test-samples
   - Test extension in VS Code

4. **Document**: Update relevant docs
   - README.md (if adding features)
   - CHANGELOG.md (describe your changes)
   - Code comments (for complex logic)

### Pull Request Process

1. **Update Your Fork**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Commit Your Changes**:
   ```bash
   git add .
   git commit -m "feat: add support for NewLanguage"
   ```

   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

3. **Push to Your Fork**:
   ```bash
   git push origin your-branch-name
   ```

4. **Create Pull Request**:
   - Go to GitHub and create a PR from your fork
   - Fill in the PR template
   - Link related issues
   - Describe your changes clearly

### PR Review Process

- Maintainers will review your PR
- Address any feedback promptly
- Once approved, your PR will be merged

## Development Tips

### Quick Commands

```bash
# Compile once
npm run compile

# Watch mode (auto-compile)
npm run watch

# Lint code
npm run lint

# Package extension
npm run package:vscode

# Test CLI
npm run cli -- --help
```

### Debugging

#### VS Code Extension
1. Set breakpoints in TypeScript files
2. Press `F5` to start debugging
3. Extension runs in new VS Code window

#### CLI Tool
1. Use `node --inspect` for debugging:
   ```bash
   node --inspect ./out/src/cli.js --check test-samples/
   ```
2. Open `chrome://inspect` in Chrome
3. Click "inspect" on your Node process

### Common Issues

**Issue**: Changes not reflected in extension
**Solution**: Restart the Extension Development Host

**Issue**: TypeScript compilation errors
**Solution**: Delete `out/` folder and run `npm run compile`

**Issue**: Module not found errors
**Solution**: Run `npm install` to ensure all dependencies are installed

## Documentation

### What to Document

- **New Features**: Add to README.md and docs/USER_GUIDE.md
- **Breaking Changes**: Highlight in CHANGELOG.md
- **Architecture**: Update docs/ARCHITECTURE.md if needed
- **Code**: Add comments for complex logic

### Documentation Style

- Use clear, concise language
- Include code examples
- Add screenshots for UI changes
- Keep formatting consistent

## Questions?

- **Issues**: [GitHub Issues](https://github.com/DEADSERPENT/importlens/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DEADSERPENT/importlens/discussions)
- **Documentation**: [docs/](docs/)

---

**Thank you for contributing to ImportLens!** 🚀
