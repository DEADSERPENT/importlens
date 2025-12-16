import * as vscode from 'vscode';
import { LanguageAdapterRegistry } from '../adapters/LanguageAdapter';
import type { ImportInfo } from '../adapters/LanguageAdapter';

/**
 * Result of analyzing a single diagnostic for unused imports
 */
export interface UnusedImport {
  /** The import information */
  importInfo: ImportInfo;
  /** The diagnostic that flagged it as unused */
  diagnostic: vscode.Diagnostic;
  /** Whether this import has side effects */
  hasSideEffects: boolean;
  /** Human-readable explanation */
  explanation: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** The document URI */
  uri: vscode.Uri;
}

/**
 * Analyzes diagnostics to identify unused imports
 */
export class ImportAnalyzer {
  constructor(private adapterRegistry: LanguageAdapterRegistry) {}

  /**
   * Find all unused imports in a document
   * @param document The document to analyze
   * @returns Array of unused imports
   */
  async findUnusedImports(document: vscode.TextDocument): Promise<UnusedImport[]> {
    try {
      // Get diagnostics for this document
      const diagnostics = vscode.languages.getDiagnostics(document.uri);

      // Filter for "unnecessary" diagnostics
      const unnecessaryDiagnostics = diagnostics.filter(d =>
        d.tags?.includes(vscode.DiagnosticTag.Unnecessary)
      );

      if (unnecessaryDiagnostics.length === 0) {
        return [];
      }

      // Get the appropriate language adapter
      const adapter = this.adapterRegistry.getAdapter(document.languageId);
      if (!adapter) {
        console.log(`No adapter found for language: ${document.languageId}`);
        return [];
      }

      // Analyze each diagnostic
      const unusedImports: UnusedImport[] = [];

      for (const diagnostic of unnecessaryDiagnostics) {
        const lineNumber = diagnostic.range.start.line;

        try {
          // Check if this line is within document bounds
          if (lineNumber >= document.lineCount) {
            continue;
          }

          const line = document.lineAt(lineNumber);

          // Find the import statement line (could be current line or earlier for multiline imports)
          let importLineNumber = lineNumber;
          if (!adapter.isImportStatement(line.text)) {
            // The diagnostic might be on a specifier within a multiline import
            // Search backward to find the import statement start
            let foundImportStart = false;
            for (let i = lineNumber - 1; i >= Math.max(0, lineNumber - 20); i--) {
              const prevLine = document.lineAt(i);
              if (adapter.isImportStatement(prevLine.text)) {
                importLineNumber = i;
                foundImportStart = true;
                break;
              }
              // Stop searching if we hit a blank line or clearly non-import line
              const trimmed = prevLine.text.trim();
              if (trimmed === '' || (trimmed.endsWith(';') && !trimmed.includes('import'))) {
                break;
              }
            }
            if (!foundImportStart) {
              continue;
            }
          }

          // Parse the import (try multiline first if supported)
          let importInfo: ImportInfo | null = null;
          if (adapter.parseMultilineImport) {
            try {
              importInfo = adapter.parseMultilineImport(document, importLineNumber);
            } catch (error) {
              console.error(`Error parsing multiline import at line ${importLineNumber}:`, error);
            }
          }
          if (!importInfo) {
            const importLine = document.lineAt(importLineNumber);
            importInfo = adapter.parseImport(importLine.text, importLineNumber);
          }
          if (!importInfo) {
            continue;
          }

          // Check for side effects
          const hasSideEffects = adapter.hasSideEffects(importInfo);

          // Get explanation
          const explanation = adapter.getExplanation(diagnostic, importInfo);

          // Calculate confidence
          const confidence = this.calculateConfidence(diagnostic, importInfo, hasSideEffects);

          unusedImports.push({
            importInfo,
            diagnostic,
            hasSideEffects,
            explanation,
            confidence,
            uri: document.uri
          });
        } catch (error) {
          console.error(`Error analyzing diagnostic at line ${lineNumber}:`, error);
          // Continue with next diagnostic instead of failing completely
        }
      }

      return unusedImports;
    } catch (error) {
      console.error(`Error finding unused imports in ${document.uri.fsPath}:`, error);
      vscode.window.showErrorMessage(`ImportLens: Failed to analyze imports - ${error}`);
      return [];
    }
  }

  /**
   * Find unused imports in multiple documents
   * @param documents Array of documents to analyze
   * @returns Map of URI to unused imports
   */
  async findUnusedImportsInWorkspace(
    documents: vscode.TextDocument[]
  ): Promise<Map<string, UnusedImport[]>> {
    const results = new Map<string, UnusedImport[]>();

    for (const document of documents) {
      try {
        const unusedImports = await this.findUnusedImports(document);
        if (unusedImports.length > 0) {
          results.set(document.uri.toString(), unusedImports);
        }
      } catch (error) {
        console.error(`Error analyzing document ${document.uri.fsPath}:`, error);
        // Continue with other documents
      }
    }

    return results;
  }

  /**
   * Calculate confidence that an import is truly unused
   * @param diagnostic The diagnostic
   * @param importInfo The import information
   * @param hasSideEffects Whether it has side effects
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(
    diagnostic: vscode.Diagnostic,
    importInfo: ImportInfo,
    hasSideEffects: boolean
  ): number {
    let confidence = 0.9; // Base confidence

    // Lower confidence for side-effect imports
    if (hasSideEffects) {
      confidence *= 0.7;
    }

    // Higher confidence for specific diagnostic sources
    const source = diagnostic.source?.toLowerCase() || '';
    if (source.includes('typescript') || source.includes('tsserver')) {
      confidence = Math.min(confidence * 1.1, 0.99);
    } else if (source.includes('pylance') || source.includes('pyright')) {
      confidence = Math.min(confidence * 1.1, 0.99);
    } else if (source.includes('jdtls') || source.includes('java')) {
      confidence = Math.min(confidence * 1.1, 0.99);
    }

    // Lower confidence for generic patterns
    if (importInfo.module === 'unknown') {
      confidence *= 0.6;
    }

    // Higher confidence for specific error codes
    // TypeScript: 6133 is "declared but never used"
    if (diagnostic.code === 6133 || diagnostic.code === '6133') {
      confidence = Math.min(confidence * 1.2, 0.99);
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get statistics about unused imports
   * @param unusedImports Array of unused imports
   * @returns Statistics object
   */
  getStatistics(unusedImports: UnusedImport[]) {
    const total = unusedImports.length;
    const withSideEffects = unusedImports.filter(u => u.hasSideEffects).length;
    const safeToRemove = total - withSideEffects;

    const byLanguage = new Map<string, number>();
    const byConfidence = {
      high: 0,    // > 0.9
      medium: 0,  // 0.7 - 0.9
      low: 0      // < 0.7
    };

    for (const unusedImport of unusedImports) {
      // Count by confidence
      if (unusedImport.confidence > 0.9) {
        byConfidence.high++;
      } else if (unusedImport.confidence > 0.7) {
        byConfidence.medium++;
      } else {
        byConfidence.low++;
      }
    }

    return {
      total,
      withSideEffects,
      safeToRemove,
      byConfidence
    };
  }
}
