# Changelog

All notable changes to ImportLens will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.1] - 2025-12-22

### Markdown files upgradation

- readme file for landing page and docs purpose 
- userguide file for the updated for version 3.0.0

## [3.0.0] - 2025-12-20

### Major Features

**Historical Debt Tracking**
- Automatic snapshot capture on every `--baseline-update` (rolling 30-snapshot history)
- Visual trend chart in Statistics Panel with dual Y-axis (unused imports + files analyzed)
- Seamless v2.0.0 → v3.0.0 migration with backward compatibility
- Shared baseline data between CLI and VS Code extension

### Breaking Changes

- Baseline file format bumped to v3.0.0 (includes `history` array)
- Auto-migration from v2.0.0 on first load (fully backward compatible)

### Improvements

- CLI displays snapshot count in console output
- Extension reads `.importlens-baseline.json` for trend visualization
- Chart.js line chart with filled areas and custom styling
- Empty state UI when no history exists

### Technical

- New interfaces: `HistoricalSnapshot`, updated `BaselineFile` and `StatisticsData`
- New methods: `migrateBaselineToV3()`, `captureSnapshot()`, `pruneHistory()`, `loadBaselineFile()`
- Files modified: `BaselineManager.ts`, `StatisticsPanel.ts`, `package.json`

## [2.0.0] - 2025-12-19

### 🎯 Major Features

#### AST-Based TypeScript/JavaScript Analysis (CLI)
- **100% Accurate CLI Detection**: Replaced regex-based analysis with Babel AST parser for TypeScript and JavaScript in the CLI tool
- **Symbol-Level Precision**: Detects which specific imports are unused within multi-symbol import statements
- **Multi-line Import Support**: Correctly handles imports spanning multiple lines
- **JSX Support**: Properly identifies component usage in React files
- **Headless Operation**: Enables accurate standalone analysis in CI/CD without requiring a language server
- **Note**: The VS Code extension continues to use LSP-based detection (tsserver, Pylance, etc.) for maximum accuracy

#### Import Organization
- **Smart Sorting**: Automatically organize imports into groups (side-effects, external, internal, relative)
- **Deduplication**: Merge duplicate imports from the same source
- **Alphabetical Ordering**: Sort named imports alphabetically within each group
- **New Command**: `ImportLens: Organize Imports` for TypeScript/JavaScript files

#### Quick Fix Code Actions
- **One-Click Removal**: Remove unused imports via VS Code's Quick Fix lightbulb
- **Partial Removal**: Remove specific unused symbols while keeping the import
- **Batch Operations**: Remove all unused imports in a file with one action
- **Smart Integration**: Works seamlessly with existing diagnostics

#### Baseline Tracking for CI/CD
- **Technical Debt Management**: Generate baseline files to track accepted unused imports
- **Prevent Regression**: Block NEW unused imports while accepting existing ones
- **Flexible Workflow**: Support for generate, update, and check operations
- **Auto-Detection**: Automatically uses baseline if `.importlens-baseline.json` exists
- **CLI Flags**:
  - `--baseline-generate` - Create initial baseline
  - `--baseline-update` - Update baseline with current state
  - `--baseline-check` - Verify no new issues beyond baseline
  - `--baseline=<path>` - Custom baseline file path

#### GitHub Actions Templates
- **Ready-to-Use Workflows**: Pre-built workflow files in `templates/` directory
- **Standard Mode**: `github-action.yml` for strict enforcement
- **Baseline Mode**: `github-action-baseline.yml` for gradual cleanup
- **PR Integration**: Automatic PR comments with detailed results
- **Artifact Upload**: Save analysis reports for review

### 🚀 Improvements

#### CLI Enhancements
- Improved help text with baseline examples
- Better error messages and user feedback
- Support for multiple output formats (text, json, github, junit)
- Enhanced file discovery with glob pattern support

#### VS Code Extension
- More responsive status bar updates
- Better error handling and user notifications
- Improved performance for large workspaces

### 🔧 Technical Changes

#### Dependencies
- Added `@babel/parser@^7.23.0` for AST parsing
- Added `@babel/traverse@^7.23.0` for AST traversal
- Added `@babel/types@^7.23.0` for AST node type checking

#### Architecture
- New `ASTAnalyzer` class for TypeScript/JavaScript analysis
- New `BaselineManager` class for baseline file operations
- New `QuickFixProvider` for VS Code Quick Fix integration
- Enhanced `CLIAnalyzer` with AST integration
- Improved separation of concerns between CLI and extension code

### 📦 Files Added
- `src/cli/ASTAnalyzer.ts` - AST-based import analyzer
- `src/cli/BaselineManager.ts` - Baseline file management
- `src/ui/QuickFixProvider.ts` - Quick Fix code action provider
- `templates/github-action.yml` - Standard GitHub Action workflow
- `templates/github-action-baseline.yml` - Baseline GitHub Action workflow
- `CHANGELOG.md` - This file

### 🐛 Bug Fixes
- Fixed false positives in TypeScript/JavaScript files (via AST analysis)
- Improved multi-line import detection across all languages
- Better handling of edge cases in import parsing
- Fixed status bar update timing issues

### 📚 Documentation
- Updated README with v2.0.0 features
- Added baseline workflow examples
- Documented Quick Fix usage
- Enhanced CLI help text with baseline instructions

### ⚠️ Breaking Changes
None. Version 2.0.0 is fully backward compatible with 1.x configurations and workflows.

---

## [1.1.1] - 2024-12-XX

### Added
- Symbol-level precision for partial import removal
- Enhanced status bar integration
- Test samples for validation

### Fixed
- Precision symbol handling
- Import detection accuracy

---

## [1.0.0] - 2024-12-XX

### Added
- Initial release
- Multi-language support (TypeScript, Python, Java, Go, Rust, C/C++)
- LSP-based diagnostics
- Safe Mode for side-effect imports
- Visual dashboard with statistics
- CLI tool for automation
- Diff preview before applying changes
- Status bar integration
- Workspace-wide cleaning

---

[2.0.0]: https://github.com/DEADSERPENT/importlens/compare/v1.1.1...v2.0.0
[1.1.1]: https://github.com/DEADSERPENT/importlens/compare/v1.0.0...v1.1.1
[1.0.0]: https://github.com/DEADSERPENT/importlens/releases/tag/v1.0.0
