import * as vscode from 'vscode';
import { LanguageAdapter, ImportInfo } from './LanguageAdapter';

/**
 * Language adapter for Rust
 * Handles use statements including nested paths and glob imports
 */
export class RustAdapter implements LanguageAdapter {
  canHandle(languageId: string): boolean {
    return languageId === 'rust';
  }

  isImportStatement(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('use ') || trimmed.startsWith('pub use ');
  }

  parseMultilineImport(document: vscode.TextDocument, lineNumber: number): ImportInfo | null {
    const firstLine = document.lineAt(lineNumber).text;
    const trimmedFirst = firstLine.trim();

    // Check if this is a potential multiline use statement
    if (!trimmedFirst.startsWith('use ') && !trimmedFirst.startsWith('pub use ')) {
      return null;
    }

    // If it ends with semicolon, it's complete
    if (trimmedFirst.endsWith(';')) {
      return null;
    }

    // Check if there's an opening brace without closing
    const openBraces = (trimmedFirst.match(/{/g) || []).length;
    const closeBraces = (trimmedFirst.match(/}/g) || []).length;

    if (openBraces === closeBraces) {
      return null; // Already balanced
    }

    // Collect lines until we find the semicolon
    let fullUse = trimmedFirst;
    let endLine = lineNumber;
    let foundEnd = false;

    for (let i = lineNumber + 1; i < Math.min(lineNumber + 30, document.lineCount); i++) {
      const nextLine = document.lineAt(i).text;
      fullUse += ' ' + nextLine.trim();
      endLine = i;

      if (nextLine.includes(';')) {
        foundEnd = true;
        break;
      }
    }

    if (!foundEnd) {
      return null;
    }

    // Clean up whitespace
    fullUse = fullUse.replace(/\s+/g, ' ').trim();

    return this.parseImportInternal(fullUse, lineNumber, endLine);
  }

  private parseImportInternal(text: string, startLine: number, endLine: number = startLine): ImportInfo | null {
    const trimmed = text.trim();

    // Remove 'pub' if present
    let useStatement = trimmed;
    if (useStatement.startsWith('pub use ')) {
      useStatement = useStatement.substring(4); // Remove 'pub '
    }

    // Remove 'use ' prefix and trailing semicolon
    useStatement = useStatement.substring(4).replace(/;\s*$/, '').trim();

    // Handle different use patterns:
    // 1. use std::io;
    // 2. use std::io::Read;
    // 3. use std::io::{Read, Write};
    // 4. use std::io::*;
    // 5. use std::io as io_mod;
    // 6. use std::{io, fs};

    // Check for alias: use path as alias;
    const aliasMatch = useStatement.match(/^(.+?)\s+as\s+(\w+)$/);
    if (aliasMatch) {
      const path = aliasMatch[1];
      const alias = aliasMatch[2];
      const parts = path.split('::');
      const originalName = parts[parts.length - 1];

      return {
        type: 'default',
        symbols: [alias],
        module: path,
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // Check for glob import: use path::*;
    if (useStatement.endsWith('::*')) {
      const modulePath = useStatement.substring(0, useStatement.length - 3);
      return {
        type: 'namespace',
        symbols: ['*'],
        module: modulePath,
        fullText: text,
        range: new vscode.Range(startLine, 0, endLine, text.length)
      };
    }

    // Check for grouped imports: use path::{A, B, C};
    const groupMatch = useStatement.match(/^(.+?)::{(.+)}$/);
    if (groupMatch) {
      const basePath = groupMatch[1];
      const groupedItems = groupMatch[2];

      if (groupedItems) {
        // Multiple items: use std::io::{Read, Write};
        const symbols = groupedItems
          .split(',')
          .map(s => s.trim())
          .map(s => {
            // Handle nested aliases: use std::io::{self, Read as R};
            const asMatch = s.match(/^(.+?)\s+as\s+(\w+)$/);
            if (asMatch) {
              return asMatch[2]; // Return alias
            }
            return s === 'self' ? basePath.split('::').pop() || s : s;
          })
          .filter(s => s.length > 0);

        return {
          type: 'named',
          symbols,
          module: basePath,
          fullText: text,
          range: new vscode.Range(startLine, 0, endLine, text.length)
        };
      }
    }

    // Simple import: use std::io;
    const parts = useStatement.split('::');
    const symbol = parts[parts.length - 1];

    return {
      type: 'default',
      symbols: [symbol],
      module: useStatement,
      fullText: text,
      range: new vscode.Range(startLine, 0, endLine, text.length)
    };
  }

  parseImport(line: string, lineNumber: number): ImportInfo | null {
    return this.parseImportInternal(line, lineNumber);
  }

  hasSideEffects(importInfo: ImportInfo): boolean {
    // Glob imports might have side effects
    if (importInfo.symbols.includes('*')) {
      return true;
    }

    // Macro imports often have side effects
    const sideEffectPatterns = [
      /#\[macro_use\]/,
      /macros?$/,
      /prelude/,
    ];

    return sideEffectPatterns.some(pattern =>
      pattern.test(importInfo.module)
    );
  }

  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string {
    let reason = 'Unknown';

    const message = diagnostic.message.toLowerCase();

    if (message.includes('unused') && message.includes('import')) {
      reason = 'Use statement present but items never referenced';
    } else if (message.includes('never used')) {
      reason = 'Imported item never accessed in code';
    } else if (message.includes('redundant')) {
      reason = 'Import is redundant (in scope or unused)';
    }

    const hasSideEffects = this.hasSideEffects(importInfo);
    const symbolsText = importInfo.symbols.length > 0
      ? `'${importInfo.symbols.join(', ')}'`
      : `'${importInfo.module}'`;

    return `Use ${symbolsText} is unused
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason}
Source: ${diagnostic.source || 'rust-analyzer'}
Side effects: ${hasSideEffects ? 'Possible (will be preserved in Safe Mode)' : 'No'}
Safe to remove: ${!hasSideEffects ? 'Yes' : 'Only in Aggressive Mode'}`;
  }
}
