import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult } from './CLIAnalyzer';

/**
 * Baseline entry representing an accepted unused import
 */
export interface BaselineEntry {
  filePath: string;
  line: number;
  importStatement: string;
  symbols: string[];
}

/**
 * Historical snapshot representing a point-in-time capture of metrics
 */
export interface HistoricalSnapshot {
  timestamp: string;              // ISO 8601 format
  metadata: {
    totalFiles: number;
    totalUnusedImports: number;
    safeToRemove?: number;        // Optional (extension-only)
    withSideEffects?: number;     // Optional (extension-only)
  };
  byLanguage?: Record<string, number>;  // Optional for richer data
  version: string;                // Snapshot format version
}

/**
 * Baseline file format
 */
export interface BaselineFile {
  version: string;
  createdAt: string;
  updatedAt: string;
  entries: BaselineEntry[];
  metadata: {
    totalFiles: number;
    totalUnusedImports: number;
  };
  history?: HistoricalSnapshot[];  // Rolling history of snapshots
}

/**
 * Manages baseline files for tracking accepted technical debt
 */
export class BaselineManager {
  private baselinePath: string;

  constructor(baselinePath?: string) {
    this.baselinePath = baselinePath || '.importlens-baseline.json';
  }

  /**
   * Generate a baseline file from analysis results
   */
  generateBaseline(results: AnalysisResult[]): BaselineFile {
    const entries: BaselineEntry[] = [];

    for (const result of results) {
      for (const unusedImport of result.unusedImports) {
        entries.push({
          filePath: this.normalizePath(result.filePath),
          line: unusedImport.line,
          importStatement: unusedImport.importStatement,
          symbols: unusedImport.symbols
        });
      }
    }

    const baseline: BaselineFile = {
      version: '3.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entries,
      metadata: {
        totalFiles: results.length,
        totalUnusedImports: entries.length
      }
    };

    return baseline;
  }

  /**
   * Save baseline to file
   */
  saveBaseline(baseline: BaselineFile): void {
    try {
      const json = JSON.stringify(baseline, null, 2);
      fs.writeFileSync(this.baselinePath, json, 'utf-8');
      console.log(`> Baseline saved to ${this.baselinePath}`);
      console.log(`  Total files: ${baseline.metadata.totalFiles}`);
      console.log(`  Total accepted unused imports: ${baseline.metadata.totalUnusedImports}`);

      // Show history info if available
      if (baseline.history && baseline.history.length > 0) {
        console.log(`  Historical snapshots: ${baseline.history.length}`);
      }
    } catch (error) {
      throw new Error(`Failed to save baseline: ${error}`);
    }
  }

  /**
   * Load baseline from file
   */
  loadBaseline(): BaselineFile | null {
    try {
      if (!fs.existsSync(this.baselinePath)) {
        return null;
      }

      const content = fs.readFileSync(this.baselinePath, 'utf-8');
      let baseline = JSON.parse(content) as any;

      // Validate baseline format
      if (!baseline.version || !baseline.entries || !Array.isArray(baseline.entries)) {
        throw new Error('Invalid baseline file format');
      }

      // Validate history if present
      if (baseline.history && !Array.isArray(baseline.history)) {
        console.warn('WARNING: Invalid history format, resetting to empty array');
        baseline.history = [];
      }

      // Auto-migrate to v3.0.0 if needed
      baseline = this.migrateBaselineToV3(baseline);

      return baseline;
    } catch (error) {
      throw new Error(`Failed to load baseline: ${error}`);
    }
  }

  /**
   * Migrate v2.0.0 baseline to v3.0.0 format
   * Initializes empty history array
   */
  private migrateBaselineToV3(baseline: any): BaselineFile {
    // Check if already v3.0.0
    if (baseline.version === '3.0.0') {
      return baseline;
    }

    // Detect v2.0.0 or earlier
    if (!baseline.history) {
      console.log('> Migrating baseline from v2.0.0 to v3.0.0...');

      const migratedBaseline: BaselineFile = {
        ...baseline,
        version: '3.0.0',
        history: []  // Initialize empty history
      };

      return migratedBaseline;
    }

    return baseline;
  }

  /**
   * Compare current results against baseline
   * Returns new unused imports that are not in the baseline
   */
  compareWithBaseline(
    results: AnalysisResult[],
    baseline: BaselineFile
  ): {
    newIssues: AnalysisResult[];
    baselineIssues: AnalysisResult[];
    summary: {
      totalNew: number;
      totalBaseline: number;
      filesWithNewIssues: number;
    };
  } {
    const baselineSet = this.createBaselineSet(baseline);
    const newIssues: AnalysisResult[] = [];
    const baselineIssues: AnalysisResult[] = [];

    for (const result of results) {
      const newUnusedImports = [];
      const baselineUnusedImports = [];

      for (const unusedImport of result.unusedImports) {
        const key = this.createEntryKey(
          result.filePath,
          unusedImport.line,
          unusedImport.importStatement
        );

        if (baselineSet.has(key)) {
          baselineUnusedImports.push(unusedImport);
        } else {
          newUnusedImports.push(unusedImport);
        }
      }

      if (newUnusedImports.length > 0) {
        newIssues.push({
          ...result,
          unusedImports: newUnusedImports
        });
      }

      if (baselineUnusedImports.length > 0) {
        baselineIssues.push({
          ...result,
          unusedImports: baselineUnusedImports
        });
      }
    }

    const totalNew = newIssues.reduce((sum, r) => sum + r.unusedImports.length, 0);
    const totalBaseline = baselineIssues.reduce((sum, r) => sum + r.unusedImports.length, 0);

    return {
      newIssues,
      baselineIssues,
      summary: {
        totalNew,
        totalBaseline,
        filesWithNewIssues: newIssues.length
      }
    };
  }

  /**
   * Update baseline with current results
   * Captures historical snapshot before updating
   */
  updateBaseline(results: AnalysisResult[]): void {
    let baseline = this.loadBaseline();

    if (!baseline) {
      // Create new baseline with empty history
      baseline = this.generateBaseline(results);
      baseline.history = [];
      baseline.version = '3.0.0';
    } else {
      // Capture current state as snapshot BEFORE updating
      const snapshot = this.captureSnapshot(baseline);

      // Initialize history if missing (v2.0.0 migration)
      if (!baseline.history) {
        baseline.history = [];
      }

      // Add snapshot to history
      baseline.history.push(snapshot);

      // Prune history to last 30 snapshots
      baseline.history = this.pruneHistory(baseline.history, 30);

      // Update baseline with new entries
      const updatedBaseline = this.generateBaseline(results);
      baseline.entries = updatedBaseline.entries;
      baseline.metadata = updatedBaseline.metadata;
      baseline.updatedAt = new Date().toISOString();
      baseline.version = '3.0.0';
    }

    this.saveBaseline(baseline);
  }

  /**
   * Capture a point-in-time snapshot from current baseline state
   */
  private captureSnapshot(baseline: BaselineFile): HistoricalSnapshot {
    return {
      timestamp: new Date().toISOString(),
      metadata: {
        totalFiles: baseline.metadata.totalFiles,
        totalUnusedImports: baseline.metadata.totalUnusedImports
      },
      version: '1.0.0'  // Snapshot format version
    };
  }

  /**
   * Keep only the last N snapshots
   * Oldest snapshots are removed first
   */
  private pruneHistory(history: HistoricalSnapshot[], maxSnapshots: number): HistoricalSnapshot[] {
    if (history.length <= maxSnapshots) {
      return history;
    }

    // Sort by timestamp (oldest first)
    const sorted = history.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Keep only the last N snapshots
    return sorted.slice(-maxSnapshots);
  }

  /**
   * Check if baseline exists
   */
  baselineExists(): boolean {
    return fs.existsSync(this.baselinePath);
  }

  /**
   * Delete baseline file
   */
  deleteBaseline(): void {
    if (fs.existsSync(this.baselinePath)) {
      fs.unlinkSync(this.baselinePath);
      console.log(`> Baseline deleted: ${this.baselinePath}`);
    }
  }

  /**
   * Create a set of baseline entry keys for fast lookup
   */
  private createBaselineSet(baseline: BaselineFile): Set<string> {
    const set = new Set<string>();

    for (const entry of baseline.entries) {
      const key = this.createEntryKey(entry.filePath, entry.line, entry.importStatement);
      set.add(key);
    }

    return set;
  }

  /**
   * Create a unique key for a baseline entry
   */
  private createEntryKey(filePath: string, line: number, importStatement: string): string {
    const normalizedPath = this.normalizePath(filePath);
    return `${normalizedPath}:${line}:${importStatement.trim()}`;
  }

  /**
   * Normalize file path for cross-platform compatibility
   */
  private normalizePath(filePath: string): string {
    // Convert to forward slashes and make relative to cwd
    const relativePath = path.relative(process.cwd(), filePath);
    return relativePath.split(path.sep).join('/');
  }

  /**
   * Print baseline comparison summary
   */
  printComparisonSummary(comparison: ReturnType<typeof this.compareWithBaseline>): void {
    console.log('\nBaseline Comparison Results:');
    console.log('─'.repeat(50));
    console.log(`New unused imports: ${comparison.summary.totalNew}`);
    console.log(`Baseline (accepted) unused imports: ${comparison.summary.totalBaseline}`);
    console.log(`Files with new issues: ${comparison.summary.filesWithNewIssues}`);
    console.log('─'.repeat(50));

    if (comparison.summary.totalNew === 0) {
      console.log('\n> No new unused imports detected!');
    } else {
      console.log('\nWARNING: New unused imports detected:');
      for (const result of comparison.newIssues) {
        console.log(`\n  ${result.filePath}:`);
        for (const unusedImport of result.unusedImports) {
          console.log(`    Line ${unusedImport.line}: ${unusedImport.importStatement}`);
          console.log(`      Unused: ${unusedImport.symbols.join(', ')}`);
        }
      }
    }
  }
}
