import * as vscode from 'vscode';
import { LanguageAdapter, ImportInfo } from './LanguageAdapter';

/**
 * Language adapter for TypeScript and JavaScript
 * Handles all JS/TS variants: .js, .ts, .jsx, .tsx
 */
export class TypeScriptAdapter implements LanguageAdapter {
  canHandle(languageId: string): boolean {
    return [
      'typescript',
      'javascript',
      'typescriptreact',
      'javascriptreact'
    ].includes(languageId);
  }

  isImportStatement(line: string): boolean {
    const trimmed = line.trim();

    // Standard import statements
    if (trimmed.startsWith('import ')) {
      return true;
    }

    // Require statements (CommonJS)
    if (/^\s*(const|let|var)\s+.*\s*=\s*require\(/.test(line)) {
      return true;
    }

    return false;
  }

  parseMultilineImport(document: vscode.TextDocument, lineNumber: number): ImportInfo | null {
    const firstLine = document.lineAt(lineNumber).text;
    const trimmedFirst = firstLine.trim();

    // Check if this might be a multiline import
    // Indicators: starts with 'import' but doesn't end with semicolon or quote
    if (!trimmedFirst.startsWith('import ')) {
      return null;
    }

    // If it's a complete single-line import, use regular parser
    if (trimmedFirst.match(/from\s+['"][^'"]+['"];?\s*$/) ||
        trimmedFirst.match(/^import\s+['"][^'"]+['"];?\s*$/)) {
      return null;
    }

    // Try to collect multiline import
    let fullImport = trimmedFirst;
    let endLine = lineNumber;
    let foundEnd = false;

    // Look for the end (from 'module' or closing brace)
    for (let i = lineNumber + 1; i < Math.min(lineNumber + 20, document.lineCount); i++) {
      const nextLine = document.lineAt(i).text;
      fullImport += ' ' + nextLine.trim();
      endLine = i;

      // Check if we've reached the end
      if (nextLine.includes('from ') || nextLine.trim().endsWith(';')) {
        foundEnd = true;
        break;
      }
    }

    if (!foundEnd) {
      return null;
    }

    // Clean up the multiline import text
    fullImport = fullImport.replace(/\s+/g, ' ').trim();

    // Try to parse with existing patterns
    const result = this.parseImportInternal(fullImport, lineNumber, endLine);
    return result;
  }

  private parseImportInternal(text: string, startLine: number, endLine: number = startLine): ImportInfo | null {
    const trimmed = text.trim();

    // Side-effect import: import 'module'
    const sideEffectMatch = trimmed.match(/^import\s+['"]([^'"]+)['"];?$/);
    if (sideEffectMatch) {
      return {
        type: 'side-effect',
        symbols: [],
        module: sideEffectMatch[1],
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // Named import: import { X, Y } from 'module'
    const namedMatch = trimmed.match(/^import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?$/);
    if (namedMatch) {
      const symbols = namedMatch[1]
        .split(',')
        .map(s => s.trim().replace(/\s+as\s+.+$/, '')) // Remove aliases
        .filter(s => s.length > 0);

      return {
        type: 'named',
        symbols,
        module: namedMatch[2],
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // Default import: import X from 'module'
    const defaultMatch = trimmed.match(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?$/);
    if (defaultMatch) {
      return {
        type: 'default',
        symbols: [defaultMatch[1]],
        module: defaultMatch[2],
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // Namespace import: import * as X from 'module'
    const namespaceMatch = trimmed.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?$/);
    if (namespaceMatch) {
      return {
        type: 'namespace',
        symbols: [namespaceMatch[1]],
        module: namespaceMatch[2],
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // Mixed import: import X, { Y, Z } from 'module'
    const mixedMatch = trimmed.match(/^import\s+(\w+)\s*,\s*{([^}]+)}\s+from\s+['"]([^'"]+)['"];?$/);
    if (mixedMatch) {
      const namedSymbols = mixedMatch[2]
        .split(',')
        .map(s => s.trim().replace(/\s+as\s+.+$/, ''))
        .filter(s => s.length > 0);

      return {
        type: 'named',
        symbols: [mixedMatch[1], ...namedSymbols],
        module: mixedMatch[3],
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // Type-only import: import type { X } from 'module'
    const typeMatch = trimmed.match(/^import\s+type\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?$/);
    if (typeMatch) {
      const symbols = typeMatch[1]
        .split(',')
        .map(s => s.trim().replace(/\s+as\s+.+$/, ''))
        .filter(s => s.length > 0);

      return {
        type: 'named',
        symbols,
        module: typeMatch[2],
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // CommonJS require: const X = require('module')
    const requireMatch = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?$/);
    if (requireMatch) {
      return {
        type: 'default',
        symbols: [requireMatch[1]],
        module: requireMatch[2],
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
    // Side-effect imports (no symbols)
    if (importInfo.type === 'side-effect') {
      return true;
    }

    // Common side-effect patterns
    const sideEffectPatterns = [
      // Polyfills and shims
      /polyfill/i,
      /shim/i,
      /@babel\/polyfill/,
      /core-js/,
      /regenerator-runtime/,

      // CSS and style files
      /\.css$/,
      /\.scss$/,
      /\.sass$/,
      /\.less$/,
      /\.styl$/,

      // Environment setup
      /dotenv/,
      /env/,

      // Framework initialization
      /reflect-metadata/,
      /zone\.js/,

      // Testing setup
      /@testing-library\/jest-dom/,
    ];

    return sideEffectPatterns.some(pattern =>
      pattern.test(importInfo.module)
    );
  }

  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string {
    let reason = 'Unknown';

    const message = diagnostic.message.toLowerCase();

    if (message.includes('never read') || message.includes('never used')) {
      reason = 'Symbol imported but never referenced in code';
    } else if (message.includes('declared but') || message.includes('is declared')) {
      reason = 'Symbol defined but zero references found in AST';
    } else if (message.includes('shadowed')) {
      reason = 'Symbol shadowed by local variable declaration';
    } else if (message.includes('type') && !message.includes('used')) {
      reason = 'Type import not used in type annotations';
    }

    const hasSideEffects = this.hasSideEffects(importInfo);
    const symbolsText = importInfo.symbols.length > 0
      ? `'${importInfo.symbols.join(', ')}'`
      : `'${importInfo.module}'`;

    return `Import ${symbolsText} is unused
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason}
Source: ${diagnostic.source || 'Language Server'}
Side effects: ${hasSideEffects ? 'Yes (will be preserved in Safe Mode)' : 'No'}
Safe to remove: ${!hasSideEffects ? 'Yes' : 'Only in Aggressive Mode'}`;
  }

  removeUnusedSymbols(importInfo: ImportInfo, unusedSymbols: string[]): string | null {
    // If no specific unused symbols, or if all symbols are unused, delete the entire import
    if (unusedSymbols.length === 0 || unusedSymbols.length === importInfo.symbols.length) {
      return null;
    }

    // Calculate which symbols to keep
    const symbolsToKeep = importInfo.symbols.filter(s => !unusedSymbols.includes(s));

    if (symbolsToKeep.length === 0) {
      return null;
    }

    // Handle different import types
    switch (importInfo.type) {
      case 'named': {
        // Check if this is a type-only import
        const isTypeOnlyImport = importInfo.fullText.match(/^import\s+type\s+{/);

        // Handle mixed imports: import Default, { Named1, Named2 } from 'module'
        const isMixedImport = importInfo.fullText.match(/^import\s+(\w+)\s*,\s*{/);

        if (isMixedImport) {
          const defaultImport = isMixedImport[1];
          // Check if default import is being kept
          if (symbolsToKeep.includes(defaultImport)) {
            const namedSymbols = symbolsToKeep.filter(s => s !== defaultImport);
            if (namedSymbols.length > 0) {
              return `import ${defaultImport}, { ${namedSymbols.join(', ')} } from '${importInfo.module}';`;
            } else {
              return `import ${defaultImport} from '${importInfo.module}';`;
            }
          } else {
            // Only named imports remain
            return `import { ${symbolsToKeep.join(', ')} } from '${importInfo.module}';`;
          }
        }

        // Handle type-only imports: import type { A, B } from 'module'
        if (isTypeOnlyImport) {
          return `import type { ${symbolsToKeep.join(', ')} } from '${importInfo.module}';`;
        }

        // Handle inline type modifiers: import { type A, B, type C } from 'module'
        // For now, we'll preserve them if they exist in the original
        const hasInlineTypeModifiers = importInfo.fullText.includes(' type ');
        if (hasInlineTypeModifiers) {
          // Try to preserve inline type modifiers by checking original text
          // This is a simplified approach - a full parser would be more accurate
          const symbolsWithModifiers = symbolsToKeep.map(symbol => {
            // Check if this symbol had a 'type' modifier in the original
            const typeModifierPattern = new RegExp(`\\btype\\s+${symbol}\\b`);
            if (typeModifierPattern.test(importInfo.fullText)) {
              return `type ${symbol}`;
            }
            return symbol;
          });
          return `import { ${symbolsWithModifiers.join(', ')} } from '${importInfo.module}';`;
        }

        // Regular named import: import { X, Y, Z } from 'module'
        return `import { ${symbolsToKeep.join(', ')} } from '${importInfo.module}';`;
      }

      case 'default':
      case 'namespace':
        // For default/namespace imports, if any symbol is kept, keep the whole import
        // These typically only have one symbol anyway
        return symbolsToKeep.length > 0 ? importInfo.fullText : null;

      case 'side-effect':
        // Side-effect imports don't have symbols to remove
        return importInfo.fullText;

      default:
        return null;
    }
  }
}
