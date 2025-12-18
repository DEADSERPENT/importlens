import * as vscode from 'vscode';
import { LanguageAdapter, ImportInfo } from './LanguageAdapter';

/**
 * Language adapter for C/C++
 * Handles #include directives for both standard library and local headers
 */
export class CppAdapter implements LanguageAdapter {
  canHandle(languageId: string): boolean {
    return languageId === 'c' || languageId === 'cpp' || languageId === 'cuda-cpp';
  }

  isImportStatement(line: string): boolean {
    const trimmed = line.trim();
    // Match #include directives (may have whitespace after #)
    return /^\s*#\s*include\s+[<"]/.test(trimmed);
  }

  parseMultilineImport(document: vscode.TextDocument, lineNumber: number): ImportInfo | null {
    // C/C++ includes are single-line, but handle line continuations with backslash
    const firstLine = document.lineAt(lineNumber).text;

    if (!this.isImportStatement(firstLine)) {
      return null;
    }

    // Check for line continuation (backslash at end)
    if (!firstLine.trim().endsWith('\\')) {
      return null; // Single line include
    }

    // Collect lines until we find one without continuation
    let fullInclude = firstLine.trimEnd();
    if (fullInclude.endsWith('\\')) {
      fullInclude = fullInclude.substring(0, fullInclude.length - 1);
    }

    let endLine = lineNumber;
    let foundEnd = false;

    for (let i = lineNumber + 1; i < Math.min(lineNumber + 10, document.lineCount); i++) {
      const nextLine = document.lineAt(i).text;
      const trimmed = nextLine.trim();

      // Remove leading whitespace and append
      fullInclude += ' ' + trimmed;
      endLine = i;

      if (!trimmed.endsWith('\\')) {
        foundEnd = true;
        fullInclude = fullInclude.replace(/\s+/g, ' ').trim();
        break;
      } else {
        // Remove trailing backslash
        fullInclude = fullInclude.substring(0, fullInclude.length - 1);
      }
    }

    if (!foundEnd) {
      return null;
    }

    return this.parseIncludeInternal(fullInclude, lineNumber, endLine);
  }

  private parseIncludeInternal(text: string, startLine: number, endLine: number = startLine): ImportInfo | null {
    const trimmed = text.trim();

    // Match: #include <header> or #include "header"
    // Pattern: #\s*include\s+(<([^>]+)>|"([^"]+)")
    const includeMatch = trimmed.match(/^\s*#\s*include\s+(?:<([^>]+)>|"([^"]+)")/);

    if (!includeMatch) {
      return null;
    }

    // includeMatch[1] = angle bracket include, includeMatch[2] = quoted include
    const header = includeMatch[1] || includeMatch[2];
    const isSystemHeader = !!includeMatch[1]; // <> vs ""

    // Extract header name (without path)
    const headerName = header.split('/').pop()?.split('\\').pop() || header;

    // Remove extension for symbol name
    const symbolName = headerName.replace(/\.(h|hpp|hh|hxx|H|HPP)$/, '');

    return {
      type: isSystemHeader ? 'default' : 'side-effect', // Quoted includes often have side effects
      symbols: [symbolName],
      module: header,
      fullText: text,
      range: new vscode.Range(startLine, 0, endLine, text.length)
    };
  }

  parseImport(line: string, lineNumber: number): ImportInfo | null {
    return this.parseIncludeInternal(line, lineNumber);
  }

  hasSideEffects(importInfo: ImportInfo): boolean {
    // Quoted includes (local headers) often have side effects
    if (importInfo.type === 'side-effect') {
      return true;
    }

    const header = importInfo.module.toLowerCase();

    // Common side-effect patterns in C/C++
    const sideEffectPatterns = [
      // Registration/initialization headers
      /register/i,
      /init/i,
      /setup/i,
      /config/i,

      // Global state and singletons
      /global/i,
      /singleton/i,

      // Test frameworks (often register tests globally)
      /gtest/i,
      /catch/i,
      /doctest/i,
      /boost.*test/i,

      // Mock/stub frameworks
      /mock/i,
      /stub/i,
      /gmock/i,

      // Logging (often initializes global loggers)
      /log/i,

      // Platform-specific initialization
      /windows\.h$/i,
      /winsock/i,

      // Third-party libraries with global initialization
      /opencv/i,
      /qt/i,

      // Precompiled headers
      /stdafx/i,
      /pch/i,

      // Headers that typically use RAII for initialization
      /_impl$/,
      /detail\//,
    ];

    // Check if header matches any side-effect pattern
    if (sideEffectPatterns.some(pattern => pattern.test(header))) {
      return true;
    }

    // Standard library headers generally don't have side effects
    // except for a few special cases
    const stdLibWithSideEffects = [
      'iostream',  // May initialize cin/cout/cerr
      'fstream',   // File stream setup
      'locale',    // Locale initialization
      'random',    // Random number generator seeding
    ];

    if (stdLibWithSideEffects.some(lib => header === lib || header.endsWith('/' + lib))) {
      return true;
    }

    return false;
  }

  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string {
    let reason = 'Unknown';

    const message = diagnostic.message.toLowerCase();

    if (message.includes('included header') && message.includes('not used')) {
      reason = 'Header included but no declarations from it are referenced';
    } else if (message.includes('unused') && message.includes('include')) {
      reason = 'Include directive present but nothing from header is used';
    } else if (message.includes('not used')) {
      reason = 'Header content not referenced in translation unit';
    }

    const hasSideEffects = this.hasSideEffects(importInfo);
    const headerType = importInfo.module.startsWith('<') ||
                       importInfo.type === 'default'
                       ? 'system header'
                       : 'local header';

    const symbolsText = importInfo.symbols.length > 0
      ? `'${importInfo.symbols.join(', ')}'`
      : `'${importInfo.module}'`;

    return `Include ${symbolsText} is unused
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason}
Type: ${headerType}
Source: ${diagnostic.source || 'clangd'}
Side effects: ${hasSideEffects ? 'Possible (will be preserved in Safe Mode)' : 'Unlikely'}
Safe to remove: ${!hasSideEffects ? 'Yes' : 'Only in Aggressive Mode'}`;
  }

  removeUnusedSymbols(importInfo: ImportInfo, unusedSymbols: string[]): string | null {
    // C/C++ includes are entire headers, not individual symbols
    // If the header is unused, remove the entire include directive

    if (unusedSymbols.length === 0 || unusedSymbols.length === importInfo.symbols.length) {
      return null; // Delete entire line
    }

    // Calculate symbols to keep
    const symbolsToKeep = importInfo.symbols.filter(s => !unusedSymbols.includes(s));

    if (symbolsToKeep.length === 0) {
      return null;
    }

    // If any symbol from the header is still used, keep the include
    return importInfo.fullText;
  }
}
