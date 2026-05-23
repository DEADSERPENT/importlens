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

  removeUnusedSymbols(importInfo: ImportInfo, unusedSymbols: string[]): string | null {
    if (unusedSymbols.length === 0 || unusedSymbols.length === importInfo.symbols.length) {
      return null;
    }
    if (importInfo.type === 'namespace') {
      return importInfo.fullText;
    }
    const symbolsToKeep = importInfo.symbols.filter(s => !unusedSymbols.includes(s));
    if (symbolsToKeep.length === 0) return null;
    return importInfo.fullText;
  }

  /**
   * Organize imports following standard Java convention:
   * java.* → javax.* → org.* → com.* → other → static imports.
   * Each group is sorted alphabetically.
   */
  organizeImports(content: string): string | null {
    const lines = content.split('\n');
    const imports: { text: string; isStatic: boolean; prefix: string }[] = [];
    let firstImportLine = -1;
    let lastImportLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('import ')) {
        if (firstImportLine === -1) firstImportLine = i;
        lastImportLine = i;
        const isStatic = trimmed.startsWith('import static ');
        const pathMatch = trimmed.match(/^import\s+(?:static\s+)?([\w.*]+)\s*;?/);
        const prefix = pathMatch ? pathMatch[1].split('.')[0] : '';
        const normalized = trimmed.endsWith(';') ? trimmed : trimmed + ';';
        imports.push({ text: normalized, isStatic, prefix });
      } else if (firstImportLine !== -1 && trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        break;
      }
    }

    if (imports.length === 0) return null;

    const ORDERED_PREFIXES = ['java', 'javax', 'org', 'com'];
    const groups = new Map<string, string[]>();
    const otherImports: string[] = [];
    const staticImports: string[] = [];

    for (const imp of imports) {
      if (imp.isStatic) {
        staticImports.push(imp.text);
      } else if (ORDERED_PREFIXES.includes(imp.prefix)) {
        const group = groups.get(imp.prefix) ?? [];
        group.push(imp.text);
        groups.set(imp.prefix, group);
      } else {
        otherImports.push(imp.text);
      }
    }

    for (const g of groups.values()) g.sort();
    otherImports.sort();
    staticImports.sort();

    const allGroups: string[][] = [
      ...ORDERED_PREFIXES.map(p => groups.get(p) ?? []),
      otherImports,
      staticImports,
    ].filter(g => g.length > 0);

    const organized = allGroups.map(g => g.join('\n')).join('\n\n');
    const before = lines.slice(0, firstImportLine).join('\n');
    const after = lines.slice(lastImportLine + 1).join('\n');

    return [before, organized, after].filter(p => p.trim() !== '').join('\n\n');
  }
}
