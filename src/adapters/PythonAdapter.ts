import * as vscode from 'vscode';
import { LanguageAdapter, ImportInfo } from './LanguageAdapter';

/**
 * Language adapter for Python
 * Handles Python import statements: import, from...import
 */
export class PythonAdapter implements LanguageAdapter {
  canHandle(languageId: string): boolean {
    return languageId === 'python';
  }

  isImportStatement(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('import ') || trimmed.startsWith('from ');
  }

  parseMultilineImport(document: vscode.TextDocument, lineNumber: number): ImportInfo | null {
    const firstLine = document.lineAt(lineNumber).text;
    const trimmedFirst = firstLine.trim();

    // Check if this is a potential multiline import
    // Pattern: from module import ( ... but no closing )
    if (!trimmedFirst.startsWith('from ') || !trimmedFirst.includes('(')) {
      return null;
    }

    // If it's already complete on one line, use regular parser
    if (trimmedFirst.includes('(') && trimmedFirst.includes(')')) {
      return null;
    }

    // Collect all lines until closing parenthesis
    let fullImport = trimmedFirst;
    let endLine = lineNumber;
    let foundEnd = false;

    for (let i = lineNumber + 1; i < Math.min(lineNumber + 50, document.lineCount); i++) {
      const nextLine = document.lineAt(i).text;
      fullImport += ' ' + nextLine.trim();
      endLine = i;

      if (nextLine.includes(')')) {
        foundEnd = true;
        break;
      }
    }

    if (!foundEnd) {
      return null;
    }

    // Clean up whitespace
    fullImport = fullImport.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

    // Parse the complete import
    return this.parseImportInternal(fullImport, lineNumber, endLine);
  }

  private parseImportInternal(text: string, startLine: number, endLine: number = startLine): ImportInfo | null {
    const trimmed = text.trim();

    // from module import X, Y, Z
    const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
    if (fromMatch) {
      const module = fromMatch[1];
      const importsStr = fromMatch[2];

      // Handle: from module import *
      if (importsStr.trim() === '*') {
        return {
          type: 'namespace',
          symbols: ['*'],
          module,
          fullText: text,
          range: new vscode.Range(startLine, 0, endLine, text.length)
        };
      }

      // Parse symbols (handle both inline and multiline with parentheses)
      let cleanImports = importsStr.replace(/[()]/g, ''); // Remove parentheses
      const symbols = cleanImports
        .split(',')
        .map(s => s.trim())
        .map(s => s.replace(/\s+as\s+.+$/, '')) // Remove aliases
        .filter(s => s.length > 0);

      return {
        type: 'named',
        symbols,
        module,
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // import module
    // import module as alias
    // import module1, module2
    const importMatch = trimmed.match(/^import\s+(.+)$/);
    if (importMatch) {
      const modules = importMatch[1]
        .split(',')
        .map(s => s.trim())
        .map(s => {
          // Handle: import module as alias
          const parts = s.split(/\s+as\s+/);
          return parts[0].trim();
        });

      return {
        type: 'default',
        symbols: modules,
        module: modules[0], // For multiple imports, use first as primary
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    return null;
  }

  parseImport(line: string, lineNumber: number): ImportInfo | null {
    return this.parseImportInternal(line, lineNumber);
  }

  hasSideEffects(importInfo: ImportInfo): boolean {
    // __future__ imports always have side effects
    if (importInfo.module === '__future__') {
      return true;
    }

    // Dunder modules often have side effects
    if (importInfo.module.startsWith('__') && importInfo.module.endsWith('__')) {
      return true;
    }

    // Common side-effect modules in Python
    const sideEffectModules = [
      'antigravity', // Easter egg but has side effects
      'this',        // Zen of Python
      'matplotlib.pyplot', // Sets up plotting backend
      'seaborn',     // Sets matplotlib styles
    ];

    if (sideEffectModules.includes(importInfo.module)) {
      return true;
    }

    // Star imports are often for side effects
    if (importInfo.symbols.includes('*')) {
      return true;
    }

    return false;
  }

  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string {
    let reason = 'Unknown';

    const message = diagnostic.message.toLowerCase();

    if (message.includes('not accessed') || message.includes('not used')) {
      reason = 'Symbol imported but never accessed in code';
    } else if (message.includes('imported but unused')) {
      reason = 'Import statement present but symbol never used';
    } else if (message.includes('undefined') || message.includes('unresolved')) {
      reason = 'Module cannot be resolved (may be unused)';
    }

    const hasSideEffects = this.hasSideEffects(importInfo);
    const symbolsText = importInfo.symbols.length > 0
      ? `'${importInfo.symbols.join(', ')}'`
      : `'${importInfo.module}'`;

    return `Import ${symbolsText} is unused
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason}
Source: ${diagnostic.source || 'Pylance'}
Side effects: ${hasSideEffects ? 'Yes (will be preserved in Safe Mode)' : 'No'}
Safe to remove: ${!hasSideEffects ? 'Yes' : 'Only in Aggressive Mode'}`;
  }
}
