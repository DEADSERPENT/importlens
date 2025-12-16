import * as vscode from 'vscode';
import { LanguageAdapter, ImportInfo } from './LanguageAdapter';

/**
 * Generic LSP adapter that works with any language
 * Uses heuristics to detect import statements across different syntaxes
 */
export class GenericLSPAdapter implements LanguageAdapter {
  canHandle(languageId: string): boolean {
    // This is the fallback adapter - it handles everything
    return true;
  }

  isImportStatement(line: string): boolean {
    const trimmed = line.trim();

    // Common import keywords across languages
    const importKeywords = [
      'import ',      // JS, TS, Python, Java, Go, Kotlin, Dart
      'from ',        // Python
      'use ',         // Rust, PHP, Perl
      'require ',     // Ruby, Lua
      'using ',       // C#
      '#include',     // C, C++
      '#import',      // Objective-C
      'load(',        // R
      'library(',     // R
      'package ',     // Go (package imports)
      'Imports ',     // VB.NET
    ];

    return importKeywords.some(keyword =>
      trimmed.startsWith(keyword) || trimmed.includes(keyword)
    );
  }

  parseImport(line: string, lineNumber: number): ImportInfo | null {
    // Generic parsing - extract what we can
    const trimmed = line.trim();

    // Try to extract module/package name using common patterns
    let module = 'unknown';
    let symbols: string[] = [];

    // Pattern: import something from "module"
    let match = trimmed.match(/from\s+['"]([^'"]+)['"]/);
    if (match) {
      module = match[1];
    }

    // Pattern: import "module"
    match = trimmed.match(/import\s+['"]([^'"]+)['"]/);
    if (match) {
      module = match[1];
      return {
        type: 'side-effect',
        symbols: [],
        module,
        fullText: line,
        range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
      };
    }

    // Pattern: import something
    match = trimmed.match(/import\s+(\w+)/);
    if (match) {
      symbols = [match[1]];
      module = match[1];
    }

    // Pattern: use something
    match = trimmed.match(/use\s+([\w:]+)/);
    if (match) {
      module = match[1];
      symbols = [match[1].split(/[:\/]/).pop() || match[1]];
    }

    return {
      type: symbols.length > 0 ? 'named' : 'side-effect',
      symbols,
      module,
      fullText: line,
      range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
    };
  }

  hasSideEffects(importInfo: ImportInfo): boolean {
    // Be conservative - assume imports might have side effects
    // Better to keep an import than to break code

    // Side-effect imports (no symbols)
    if (importInfo.type === 'side-effect') {
      return true;
    }

    // If we can't determine safely, assume side effects
    if (importInfo.module === 'unknown') {
      return true;
    }

    // Common patterns that suggest side effects
    const sideEffectPatterns = [
      /polyfill/i,
      /shim/i,
      /setup/i,
      /config/i,
      /init/i,
      /\.css$/,
      /\.scss$/,
      /\.less$/,
      /stylesheet/i,
    ];

    return sideEffectPatterns.some(pattern =>
      pattern.test(importInfo.module) || pattern.test(importInfo.fullText)
    );
  }

  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string {
    let reason = 'Unknown';

    const message = diagnostic.message.toLowerCase();

    if (message.includes('unused') || message.includes('not used')) {
      reason = 'Symbol appears to be unused based on language server analysis';
    } else if (message.includes('never')) {
      reason = 'Symbol never referenced in code';
    } else if (message.includes('unnecessary')) {
      reason = 'Marked as unnecessary by language server';
    }

    const hasSideEffects = this.hasSideEffects(importInfo);
    const symbolsText = importInfo.symbols.length > 0
      ? `'${importInfo.symbols.join(', ')}'`
      : `'${importInfo.module}'`;

    return `Import ${symbolsText} may be unused
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason}
Source: ${diagnostic.source || 'Language Server'}
Note: Generic adapter in use - results may be conservative
Side effects: ${hasSideEffects ? 'Possibly (will be preserved in Safe Mode)' : 'Unknown'}
Safe to remove: ${!hasSideEffects ? 'Likely yes' : 'Review recommended'}`;
  }
}
