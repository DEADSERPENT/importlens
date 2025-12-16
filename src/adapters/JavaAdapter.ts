import * as vscode from 'vscode';
import { LanguageAdapter, ImportInfo } from './LanguageAdapter';

/**
 * Language adapter for Java
 * Handles import statements and static imports
 */
export class JavaAdapter implements LanguageAdapter {
  canHandle(languageId: string): boolean {
    return languageId === 'java';
  }

  isImportStatement(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('import ');
  }

  parseImport(line: string, lineNumber: number): ImportInfo | null {
    const trimmed = line.trim();

    // Static import: import static package.Class.method;
    // import static package.Class.*;
    const staticMatch = trimmed.match(/^import\s+static\s+([\w.]+?)(?:\.([\w*]+))?\s*;?\s*$/);
    if (staticMatch) {
      const fullPath = staticMatch[1];
      const member = staticMatch[2] || '*';
      const parts = fullPath.split('.');
      const className = parts[parts.length - 1];

      return {
        type: member === '*' ? 'namespace' : 'named',
        symbols: [member === '*' ? className + '.*' : member],
        module: fullPath,
        fullText: line,
        range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
      };
    }

    // Regular import: import package.Class;
    // Star import: import package.*;
    const importMatch = trimmed.match(/^import\s+([\w.*]+?)\s*;?\s*$/);
    if (importMatch) {
      const fullPath = importMatch[1];

      // Check if it's a star import
      if (fullPath.endsWith('.*')) {
        const packageName = fullPath.substring(0, fullPath.length - 2);
        return {
          type: 'namespace',
          symbols: ['*'],
          module: packageName,
          fullText: line,
          range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
        };
      }

      // Regular single class import
      const parts = fullPath.split('.');
      const className = parts[parts.length - 1];

      return {
        type: 'default',
        symbols: [className],
        module: fullPath,
        fullText: line,
        range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
      };
    }

    return null;
  }

  hasSideEffects(importInfo: ImportInfo): boolean {
    // Star imports might have side effects (static initializers)
    if (importInfo.symbols.includes('*')) {
      return true;
    }

    // Static imports of specific members are generally safe
    // Regular imports rarely have side effects in Java
    // But some testing frameworks might
    const sideEffectPatterns = [
      /junit/i,
      /mockito/i,
      /testng/i,
      /\.annotation\./,
    ];

    return sideEffectPatterns.some(pattern =>
      pattern.test(importInfo.module)
    );
  }

  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string {
    let reason = 'Unknown';

    const message = diagnostic.message.toLowerCase();

    if (message.includes('never used') || message.includes('not used')) {
      reason = 'Import declared but class/member never referenced';
    } else if (message.includes('unused import')) {
      reason = 'Import statement present but not needed';
    } else if (message.includes('redundant')) {
      reason = 'Import is redundant (class in same package or java.lang)';
    }

    const hasSideEffects = this.hasSideEffects(importInfo);
    const symbolsText = importInfo.symbols.length > 0
      ? `'${importInfo.symbols.join(', ')}'`
      : `'${importInfo.module}'`;

    return `Import ${symbolsText} is unused
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason}
Source: ${diagnostic.source || 'Java Language Server'}
Side effects: ${hasSideEffects ? 'Possible (will be preserved in Safe Mode)' : 'No'}
Safe to remove: ${!hasSideEffects ? 'Yes' : 'Only in Aggressive Mode'}`;
  }
}
