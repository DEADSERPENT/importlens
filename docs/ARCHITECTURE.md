# ImportLens - Architecture & Vision

## Table of Contents

- [System Architecture](#system-architecture)
- [Vision & Goals](#vision--goals)
- [Design Principles](#design-principles)
- [Future Roadmap](#future-roadmap)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                    ImportLens                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │  VS Code         │         │  CLI Tool        │    │
│  │  Extension       │         │  (Headless)      │    │
│  │                  │         │                  │    │
│  │  - UI Layer      │         │  - Arg Parser    │    │
│  │  - Commands      │         │  - File Scanner  │    │
│  │  - Decorations   │         │  - Formatters    │    │
│  │  - Status Bar    │         │  - Exit Codes    │    │
│  └────────┬─────────┘         └────────┬─────────┘    │
│           │                            │               │
│           └──────────┬─────────────────┘               │
│                      │                                 │
│         ┌────────────▼────────────┐                    │
│         │   Shared Core Engine    │                    │
│         │                         │                    │
│         │  - ImportAnalyzer       │                    │
│         │  - SafeEditExecutor     │                    │
│         │  - Language Adapters    │                    │
│         └─────────────────────────┘                    │
│                      │                                 │
│         ┌────────────▼────────────┐                    │
│         │  Language Adapters      │                    │
│         │  (Pluggable)            │                    │
│         │                         │                    │
│         │  - TypeScript/JS        │                    │
│         │  - Python               │                    │
│         │  - Java                 │                    │
│         │  - Go                   │                    │
│         │  - Rust                 │                    │
│         │  - C/C++                │                    │
│         │  - Generic LSP          │                    │
│         └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Import Analyzer (`core/ImportAnalyzer.ts`)

**Purpose**: Central analysis engine that detects unused imports.

**Responsibilities**:
- Coordinate language-specific adapters
- Aggregate diagnostics from LSP
- Identify truly unused imports
- Filter false positives

**Key Methods**:
```typescript
async findUnusedImports(document): Promise<UnusedImport[]>
```

#### 2. Language Adapter Registry (`adapters/LanguageAdapter.ts`)

**Purpose**: Pluggable adapter system for multi-language support.

**Adapter Interface**:
```typescript
interface LanguageAdapter {
  languages: string[];
  canHandle(languageId: string): boolean;
  findImportRanges(document): ImportRange[];
  isSideEffectImport(importStatement): boolean;
  extractUnusedSymbols(importInfo, diagnostics): string[];
}
```

**Adapters**:
- **TypeScriptAdapter**: Handles TS/JS named, default, namespace imports
- **PythonAdapter**: Handles import/from import statements
- **JavaAdapter**: Handles static and regular imports
- **GoAdapter**: Handles package imports
- **RustAdapter**: Handles use statements
- **CppAdapter**: Handles #include directives
- **GenericLSPAdapter**: Fallback for unknown languages

#### 3. Safe Edit Executor (`core/SafeEditExecutor.ts`)

**Purpose**: Safely removes imports with validation and rollback.

**Features**:
- Symbol-level precision (removes specific symbols, not entire lines)
- Diff preview before changes
- User confirmation workflow
- Validation after edits
- Rollback on errors

**Modes**:
- **Safe Mode**: Preserves side-effect imports (e.g., `import './styles.css'`)
- **Aggressive Mode**: Removes all unused imports

#### 4. Diagnostic Listener (`core/DiagnosticListener.ts`)

**Purpose**: Real-time monitoring of LSP diagnostics.

**Features**:
- Debounced diagnostic processing (500ms)
- Caching with TTL (5s)
- Performance optimizations
- Callback support for UI updates

#### 5. CLI Engine (`cli/`)

**Purpose**: Headless execution for CI/CD.

**Components**:
- **ArgumentParser**: CLI argument parsing and config loading
- **FileDiscovery**: Glob pattern matching and file scanning
- **CLIAnalyzer**: Headless import analysis
- **OutputFormatter**: Multiple format support (text, JSON, GitHub, JUnit)

#### 6. Baseline Manager (`cli/BaselineManager.ts`)

**Purpose**: Technical debt tracking and historical trend analysis.

**Responsibilities**:
- Manage baseline files (`.importlens-baseline.json`)
- Capture historical snapshots automatically
- Migrate between baseline versions (v2.0.0 → v3.0.0)
- Prune history to maintain 30-snapshot rolling window
- Compare current state against baseline

**Key Features**:
- **Automatic Snapshots**: Captures state before each `--baseline-update`
- **Version Migration**: Seamlessly upgrades v2.0.0 → v3.0.0
- **Rolling History**: Maintains last 30 snapshots with auto-pruning
- **Shared Data**: CLI and extension read same baseline file

**Data Structures**:
```typescript
interface HistoricalSnapshot {
  timestamp: string;              // ISO 8601 format
  metadata: {
    totalFiles: number;
    totalUnusedImports: number;
  };
  version: string;                // Snapshot format version
}

interface BaselineFile {
  version: string;                // "3.0.0"
  createdAt: string;
  updatedAt: string;
  entries: BaselineEntry[];
  metadata: { ... };
  history?: HistoricalSnapshot[]; // Rolling 30-snapshot history
}
```

#### 7. Statistics Panel (`ui/StatisticsPanel.ts`)

**Purpose**: Visual analytics dashboard for unused imports.

**Features**:
- Real-time statistics collection from workspace
- Chart.js visualization (bar, doughnut, line charts)
- Historical trend analysis (when baseline exists)
- Top files heatmap

**Charts**:
- **Language Distribution**: Bar chart of unused imports by language
- **Confidence Distribution**: Doughnut chart of high/medium/low confidence
- **Historical Trends**: Dual Y-axis line chart (unused imports + files analyzed)

**Data Flow**:
```
Command Triggered → collectStatistics()
     ↓
Analyze All Workspace Docs → findUnusedImports()
     ↓
Load Baseline File (if exists) → loadBaselineFile()
     ↓
Merge Current Stats + History → StatisticsData
     ↓
Generate HTML with Chart.js → getHtmlForWebview()
     ↓
Render in Webview Panel
```

### Data Flow

#### VS Code Extension Flow

```
User Opens File
      ↓
DiagnosticListener Activated
      ↓
LSP Diagnostics Received
      ↓
ImportAnalyzer.findUnusedImports()
      ↓
Language Adapter Selected
      ↓
Import Ranges Identified
      ↓
Unused Symbols Extracted
      ↓
UI Updated (Decorations + Status Bar)
      ↓
User Triggers Clean Command
      ↓
SafeEditExecutor.execute()
      ↓
Diff Preview Shown
      ↓
User Confirms
      ↓
Edits Applied with Validation
```

#### CLI Tool Flow

```
CLI Invoked
      ↓
ArgumentParser.parseArgs()
      ↓
Config File Loaded
      ↓
FileDiscovery.discoverFiles()
      ↓
For Each File:
  ├─ CLIAnalyzer.analyzeFile()
  ├─ Detect Language
  ├─ Find Unused Imports
  └─ Store Results
      ↓
OutputFormatter.format()
      ↓
Output Generated (text/JSON/GitHub/JUnit)
      ↓
Exit with Code (0 = success, 1 = issues found)
```

### Technology Stack

**Language**: TypeScript
**Runtime**: Node.js
**VS Code API**: v1.85.0+
**Build Tool**: TypeScript Compiler (tsc)
**Package Manager**: npm
**Testing**: Mocha (planned)
**Linting**: ESLint

### Performance Optimizations

1. **Debouncing**: 500ms delay for diagnostic changes
2. **Caching**: 5-second TTL for analysis results
3. **Lazy Loading**: Adapters loaded on-demand
4. **Incremental Analysis**: Only analyze changed files
5. **Exclude Patterns**: Skip large directories (node_modules, dist)

---



---

## License & Attribution

**License**: MIT
**Copyright**: © 2024 ImportLens Contributors
**Maintainer**: SAMARTHASMG14

---

## Summary

ImportLens is built on a foundation of:
- **Solid Architecture**: Plugin-based, extensible, maintainable
- **Clear Vision**: Make code cleaner through automation
- **Developer-First**: UX matters as much as features
- **Community-Driven**: Open source, welcoming contributions

From a simple unused import detector to a comprehensive code quality tool, ImportLens aims to be the go-to solution for import management across all languages and platforms.
