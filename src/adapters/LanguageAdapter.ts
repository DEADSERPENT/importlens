import * as vscode from 'vscode';

/**
 * Represents information about an import statement
 */
export interface ImportInfo {
  /** Type of import: named, default, namespace, or side-effect */
  type: 'named' | 'default' | 'namespace' | 'side-effect';
  /** Imported symbols (e.g., ['useState', 'useEffect']) */
  symbols: string[];
  /** Module being imported from (e.g., 'react') */
  module: string;
  /** Full import statement text */
  fullText: string;
  /** Range in the document */
  range: vscode.Range;
}

/**
 * Interface that all language adapters must implement.
 * This allows the extension to support multiple languages
 * without writing custom parsers for each one.
 */
export interface LanguageAdapter {
  /**
   * Check if this adapter can handle the given language
   * @param languageId VS Code language identifier (e.g., 'typescript', 'python')
   */
  canHandle(languageId: string): boolean;

  /**
   * Check if a line of text is an import statement
   * @param line The line of text to check
   * @returns true if this is an import statement
   */
  isImportStatement(line: string): boolean;

  /**
   * Parse an import statement to extract details
   * @param line The import statement text
   * @param lineNumber The line number in the document
   * @returns Import information or null if not parseable
   */
  parseImport(line: string, lineNumber: number): ImportInfo | null;

  /**
   * Parse a potentially multiline import statement
   * @param document The text document
   * @param lineNumber The line number where the import starts
   * @returns Import information or null if not parseable
   */
  parseMultilineImport?(document: vscode.TextDocument, lineNumber: number): ImportInfo | null;

  /**
   * Determine if an import has side effects and should be preserved
   * @param importInfo The import information
   * @returns true if this import likely has side effects
   */
  hasSideEffects(importInfo: ImportInfo): boolean;

  /**
   * Get a human-readable explanation for why an import is unused
   * @param diagnostic The VS Code diagnostic
   * @param importInfo The import information
   * @returns Explanation text
   */
  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string;

  /**
   * Remove specific unused symbols from an import statement
   * This enables partial import cleanup (e.g., remove only unused symbols from a multi-symbol import)
   * @param importInfo The original import information
   * @param unusedSymbols Array of symbol names that are unused
   * @returns New import text with unused symbols removed, or null to delete the entire line
   */
  removeUnusedSymbols?(importInfo: ImportInfo, unusedSymbols: string[]): string | null;
}

/**
 * Registry for managing language adapters
 */
export class LanguageAdapterRegistry {
  private adapters: LanguageAdapter[] = [];
  private genericAdapter: LanguageAdapter | null = null;

  /**
   * Register a language adapter
   * @param adapter The adapter to register
   * @param isGeneric If true, this is the fallback adapter
   */
  register(adapter: LanguageAdapter, isGeneric: boolean = false): void {
    if (isGeneric) {
      this.genericAdapter = adapter;
    } else {
      this.adapters.push(adapter);
    }
  }

  /**
   * Get the appropriate adapter for a language
   * @param languageId VS Code language identifier
   * @returns The matching adapter or generic adapter
   */
  getAdapter(languageId: string): LanguageAdapter | null {
    // Try to find a specific adapter
    const specificAdapter = this.adapters.find(a => a.canHandle(languageId));
    if (specificAdapter) {
      return specificAdapter;
    }

    // Fall back to generic adapter
    return this.genericAdapter;
  }

  /**
   * Check if a language is supported
   * @param languageId VS Code language identifier
   */
  isLanguageSupported(languageId: string): boolean {
    return this.getAdapter(languageId) !== null;
  }
}
