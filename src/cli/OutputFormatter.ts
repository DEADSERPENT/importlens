import { AnalysisResult } from './CLIAnalyzer';

export class OutputFormatter {
  constructor(private outputFormat: 'text' | 'json' | 'github' | 'junit') {}

  /**
   * Format analysis results according to specified format
   */
  format(results: AnalysisResult[]): string {
    switch (this.outputFormat) {
      case 'json':
        return this.formatJSON(results);
      case 'github':
        return this.formatGitHub(results);
      case 'junit':
        return this.formatJUnit(results);
      case 'text':
      default:
        return this.formatText(results);
    }
  }

  /**
   * Format as human-readable text
   */
  private formatText(results: AnalysisResult[]): string {
    const lines: string[] = [];
    let totalIssues = 0;

    lines.push('ImportLens Analysis Results');
    lines.push('===========================\n');

    for (const result of results) {
      if (result.error) {
        lines.push(`[ERROR] ${result.filePath}`);
        lines.push(`        ${result.error}\n`);
        continue;
      }

      if (result.unusedImports.length === 0) {
        lines.push(`[OK] ${result.filePath} - No unused imports`);
        continue;
      }

      totalIssues += result.unusedImports.length;

      lines.push(`\n[WARN] ${result.filePath}`);
      lines.push(`   Found ${result.unusedImports.length} unused import(s):\n`);

      for (const unused of result.unusedImports) {
        lines.push(`   Line ${unused.line}: ${unused.importStatement}`);
        lines.push(`   → ${unused.reason}`);
        lines.push('');
      }
    }

    lines.push('\n' + '='.repeat(50));
    lines.push(`Total: ${totalIssues} unused import(s) in ${results.length} file(s)`);

    return lines.join('\n');
  }

  /**
   * Format as JSON
   */
  private formatJSON(results: AnalysisResult[]): string {
    const summary = {
      totalFiles: results.length,
      filesWithIssues: results.filter(r => r.unusedImports.length > 0).length,
      totalUnusedImports: results.reduce((sum, r) => sum + r.unusedImports.length, 0),
      results: results.map(r => ({
        filePath: r.filePath,
        language: r.language,
        unusedImportCount: r.unusedImports.length,
        unusedImports: r.unusedImports,
        error: r.error
      }))
    };

    return JSON.stringify(summary, null, 2);
  }

  /**
   * Format as GitHub Actions annotations
   * See: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
   */
  private formatGitHub(results: AnalysisResult[]): string {
    const lines: string[] = [];

    for (const result of results) {
      if (result.error) {
        lines.push(
          `::error file=${result.filePath}::Analysis error: ${result.error}`
        );
        continue;
      }

      for (const unused of result.unusedImports) {
        const message = `Unused import: ${unused.symbols.join(', ')} - ${unused.reason}`;
        lines.push(
          `::warning file=${result.filePath},line=${unused.line}::${message}`
        );
      }
    }

    // Add summary
    const totalIssues = results.reduce((sum, r) => sum + r.unusedImports.length, 0);
    if (totalIssues > 0) {
      lines.push(`::notice::Found ${totalIssues} unused import(s) in ${results.length} file(s)`);
    } else {
      lines.push('::notice::No unused imports found');
    }

    return lines.join('\n');
  }

  /**
   * Format as JUnit XML (for CI systems that support it)
   */
  private formatJUnit(results: AnalysisResult[]): string {
    const totalTests = results.length;
    const failures = results.filter(r => r.unusedImports.length > 0 || r.error).length;
    const totalIssues = results.reduce((sum, r) => sum + r.unusedImports.length, 0);

    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      `<testsuites name="ImportLens" tests="${totalTests}" failures="${failures}">`
    );
    lines.push('  <testsuite name="Unused Import Detection">');

    for (const result of results) {
      const hasIssues = result.unusedImports.length > 0 || result.error;
      const status = hasIssues ? 'failure' : 'success';

      lines.push(`    <testcase name="${this.escapeXml(result.filePath)}" status="${status}">`);

      if (result.error) {
        lines.push(`      <failure message="Analysis error">`);
        lines.push(`        ${this.escapeXml(result.error)}`);
        lines.push(`      </failure>`);
      } else if (result.unusedImports.length > 0) {
        lines.push(`      <failure message="Found ${result.unusedImports.length} unused import(s)">`);
        for (const unused of result.unusedImports) {
          lines.push(`        Line ${unused.line}: ${this.escapeXml(unused.importStatement)}`);
          lines.push(`        → ${this.escapeXml(unused.reason)}`);
        }
        lines.push(`      </failure>`);
      }

      lines.push('    </testcase>');
    }

    lines.push('  </testsuite>');
    lines.push('</testsuites>');

    return lines.join('\n');
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
