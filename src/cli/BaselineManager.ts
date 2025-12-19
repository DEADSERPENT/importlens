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
      version: '2.0.0',
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
      console.log(`✓ Baseline saved to ${this.baselinePath}`);
      console.log(`  Total files: ${baseline.metadata.totalFiles}`);
      console.log(`  Total accepted unused imports: ${baseline.metadata.totalUnusedImports}`);
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
      const baseline = JSON.parse(content) as BaselineFile;

      // Validate baseline format
      if (!baseline.version || !baseline.entries || !Array.isArray(baseline.entries)) {
        throw new Error('Invalid baseline file format');
      }

      return baseline;
    } catch (error) {
      throw new Error(`Failed to load baseline: ${error}`);
    }
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
   */
  updateBaseline(results: AnalysisResult[]): void {
    let baseline = this.loadBaseline();

    if (!baseline) {
      // Create new baseline
      baseline = this.generateBaseline(results);
    } else {
      // Update existing baseline
      baseline = this.generateBaseline(results);
      baseline.updatedAt = new Date().toISOString();
    }

    this.saveBaseline(baseline);
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
      console.log(`✓ Baseline deleted: ${this.baselinePath}`);
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
    console.log('\n📊 Baseline Comparison Results:');
    console.log('─'.repeat(50));
    console.log(`New unused imports: ${comparison.summary.totalNew}`);
    console.log(`Baseline (accepted) unused imports: ${comparison.summary.totalBaseline}`);
    console.log(`Files with new issues: ${comparison.summary.filesWithNewIssues}`);
    console.log('─'.repeat(50));

    if (comparison.summary.totalNew === 0) {
      console.log('\n✓ No new unused imports detected!');
    } else {
      console.log('\n⚠️  New unused imports detected:');
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
