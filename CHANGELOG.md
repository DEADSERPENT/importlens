# Changelog

All notable changes to ImportLens will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2026-05-23

### Git Integration for Team Analytics

- Developer contribution metrics now populated from `git log` history
- `TeamAnalyticsEngine.loadGitContributors(workspaceRoot)` resolves each file's primary author
- `DeveloperMetric` fields (`filesOwned`, `averageHealthScore`, `mostImprovedFiles`, `contribution`) are live data
- Team Dashboard automatically shows top contributors when workspace is a git repo
- Silent no-op when git is unavailable or workspace is not a repository

### Cross-Language Organize Imports

- `ImportLens: Organize Imports` command now supports **Python**, **Java**, and **Go** in addition to TypeScript/JavaScript
- Python: PEP 8 groups (`__future__` → stdlib → third-party → local), each group sorted alphabetically
- Java: standard package groups (`java.*` → `javax.*` → `org.*` → `com.*` → other → static), sorted per group
- Go: stdlib → third-party split with a blank line, consolidated into a single `import(...)` block
- Added optional `organizeImports(content)` method to `LanguageAdapter` interface

### Universal AST Parsing via Tree-sitter

- New `TreeSitterAnalyzer` class provides AST-level import detection for Python, Java, Go, and Rust in the CLI
- Eliminates regex false-positives caused by import symbols appearing inside strings or comments
- Correctly handles multiline imports in all supported languages
- Tree-sitter grammars are **optional dependencies** — CLI falls back to existing regex heuristics when packages are absent
- Install all grammars: `npm install --save-optional tree-sitter tree-sitter-python tree-sitter-java tree-sitter-go tree-sitter-rust`

### High-Performance Parallel CLI Execution

- `CLIAnalyzer.analyzeFiles()` now distributes work across Node.js worker threads for file sets ≥ 8
- Worker count auto-scales to logical CPU count (`os.cpus().length`)
- New `AnalyzerWorker.ts` provides the isolated per-worker analysis script
- Sequential fallback preserved automatically when workers are unavailable
- Benchmark: linear speedup on multi-core machines for large monorepos

### Technical

**New Files**
- `src/cli/TreeSitterAnalyzer.ts` — Tree-sitter based import analyzer
- `src/cli/AnalyzerWorker.ts` — Worker thread entry point

**Modified Files**
- `src/analytics/TeamAnalytics.ts` — `GitIntegration` class, `loadGitContributors`, `getTopContributors`, updated `generateDashboard`
- `src/cli/CLIAnalyzer.ts` — Worker thread pool, `TreeSitterAnalyzer` integration, C/C++ header heuristics
- `src/adapters/LanguageAdapter.ts` — Optional `organizeImports` method added to interface
- `src/adapters/PythonAdapter.ts` — `organizeImports` implementation (PEP 8)
- `src/adapters/JavaAdapter.ts` — `organizeImports` implementation (package groups)
- `src/adapters/GoAdapter.ts` — `organizeImports` implementation (stdlib/third-party split)
- `src/extension.ts` — `organizeImports` command extended to all adapter-supported languages
- `src/ui/TeamDashboardPanel.ts` — Passes workspace root for git contributor resolution
- `package.json` — Version 3.2.0, optional tree-sitter dependencies

### Backward Compatibility

- Fully backward compatible with v3.1.x
- All existing CLI flags and VS Code commands unchanged
- Tree-sitter is opt-in (optional dependency); existing regex analysis unchanged when absent
- Worker threads have automatic sequential fallback

## [3.1.0] - 2025-12-22

### Major Features - Phase 6: Enhanced Team Analytics

**Team Dashboard (VS Code)**
- Interactive webview dashboard with workspace-wide analytics
- Import health score (0-100) calculated for each file and overall workspace
- Language breakdown with file counts and unused import statistics
- Files needing attention identified by low health scores
- Top improved files tracking based on trend analysis
- Export functionality (JSON/CSV) for stakeholder reports
- Custom SVG icon system (replaced all Unicode emojis)
- Theme-aware styling that adapts to VS Code themes
- Click-to-open file navigation

**CLI Analytics**
- New `--analytics` flag for generating team analytics reports
- `--analytics-output=<file>` to save reports to file
- JSON output format for automation and integration
- Terminal-friendly summary display
- Same analytics engine shared with VS Code extension

**Analytics Engine**
- Health score calculation with configurable thresholds
- Trend detection (improving/declining/stable) with 2% threshold
- File-level metrics tracking (imports, unused, health score, language)
- Team-level aggregation and statistics
- Language breakdown analytics

### Improvements

**Icon System**
- Replaced all Unicode emojis with custom SVG icons in webview
- Text-based indicators for CLI output ([OK], [WARN], [ERROR], [SUCCESS])
- Theme-aware icons using currentColor for VS Code compatibility
- Reusable SVG symbol definitions for consistency

**Code Quality**
- New analytics module (`src/analytics/TeamAnalytics.ts`)
- Clean separation of concerns (analytics, UI, CLI)
- Full TypeScript type safety
- Comprehensive test coverage (46 test cases, 100% pass rate)

### Technical

**New Files**
- `src/analytics/TeamAnalytics.ts` - Core analytics engine with HealthScoreCalculator
- `src/ui/TeamDashboardPanel.ts` - Webview dashboard UI
- `docs/TEST_REPORT.md` - Comprehensive test report

**Modified Files**
- `src/extension.ts` - Added Team Dashboard command and analytics integration
- `src/cli.ts` - Added analytics mode and report generation
- `src/cli/ArgumentParser.ts` - Added `--analytics` flag support
- `package.json` - Added Team Dashboard command, updated version to 3.1.0

**New Interfaces**
- `FileHealthMetric` - Individual file metrics
- `DeveloperMetric` - Developer contribution tracking
- `TeamHealthScore` - Overall workspace health
- `LanguageBreakdown` - Per-language statistics
- `TeamDashboardData` - Complete dashboard data structure
- `ComparisonMetric` - Historical comparison data
- `AnalyticsExportData` - Export format

### Commands

**VS Code**
- `ImportLens: Show Team Dashboard` - Opens interactive analytics dashboard

**CLI**
- `importlens-cli --analytics <files>` - Generate analytics report
- `importlens-cli --analytics --analytics-output=report.json <files>` - Save to file

### Backward Compatibility

- Fully backward compatible with v3.0.x
- All existing features continue to work
- No breaking changes
- VS Code Extension and CLI Tool both preserved

### Testing

- 46 test cases executed
- 100% pass rate
- Full regression testing completed
- Production ready

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
