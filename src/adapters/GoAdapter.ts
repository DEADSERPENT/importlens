import * as vscode from 'vscode';
import { LanguageAdapter, ImportInfo } from './LanguageAdapter';

/**
 * Language adapter for Go
 * Handles both single and grouped import statements
 */
export class GoAdapter implements LanguageAdapter {
  canHandle(languageId: string): boolean {
    return languageId === 'go';
  }

  isImportStatement(line: string): boolean {
    const trimmed = line.trim();
    // Direct import or import group start
    return trimmed.startsWith('import ') || trimmed === 'import (';
  }

  parseMultilineImport(document: vscode.TextDocument, lineNumber: number): ImportInfo | null {
    const firstLine = document.lineAt(lineNumber).text;
    const trimmedFirst = firstLine.trim();

    // Check for import group: import (
    if (trimmedFirst !== 'import (') {
      return null;
    }

    // Collect all imports until closing parenthesis
    const imports: string[] = [];
    let endLine = lineNumber;
    let foundEnd = false;

    for (let i = lineNumber + 1; i < Math.min(lineNumber + 100, document.lineCount); i++) {
      const line = document.lineAt(i).text;
      const trimmed = line.trim();

      if (trimmed === ')') {
        endLine = i;
        foundEnd = true;
        break;
      }

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('//')) {
        continue;
      }

      imports.push(trimmed);
    }

    if (!foundEnd || imports.length === 0) {
      return null;
    }

    // For multiline import groups, we don't remove individual lines
    // This is a special case - return null to let diagnostics handle each line
    return null;
  }

  parseImport(line: string, lineNumber: number): ImportInfo | null {
    const trimmed = line.trim();

    // Single import: import "package/path"
    // Aliased import: import alias "package/path"
    // Dot import: import . "package/path"
    // Blank import: import _ "package/path"

    // Match: import [alias] "path"
    const importMatch = trimmed.match(/^import\s+(?:(\w+|_|\.)\s+)?["']([^"']+)["']/);
    if (importMatch) {
      const alias = importMatch[1];
      const packagePath = importMatch[2];

      // Extract package name from path
      const parts = packagePath.split('/');
      const packageName = parts[parts.length - 1];

      // Determine symbol based on alias
      let symbol: string;
      if (alias === '_') {
        // Blank import (side-effect only)
        return {
          type: 'side-effect',
          symbols: [],
          module: packagePath,
          fullText: line,
          range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
        };
      } else if (alias === '.') {
        // Dot import (imports into current namespace)
        symbol = packageName + '.*';
      } else if (alias) {
        // Aliased import
        symbol = alias;
      } else {
        // Regular import
        symbol = packageName;
      }

      return {
        type: alias === '.' ? 'namespace' : 'default',
        symbols: [symbol],
        module: packagePath,
        fullText: line,
        range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
      };
    }

    // Handle bare import path (inside import group)
    const bareMatch = trimmed.match(/^["']([^"']+)["']/);
    if (bareMatch) {
      const packagePath = bareMatch[1];
      const parts = packagePath.split('/');
      const packageName = parts[parts.length - 1];

      return {
        type: 'default',
        symbols: [packageName],
        module: packagePath,
        fullText: line,
        range: new vscode.Range(lineNumber, 0, lineNumber, line.length)
      };
    }

    return null;
  }

  hasSideEffects(importInfo: ImportInfo): boolean {
    // Side-effect imports (blank imports with _)
    if (importInfo.type === 'side-effect') {
      return true;
    }

    // Common side-effect packages
    const sideEffectPatterns = [
      /\/pprof$/,           // profiling
      /\/expvar$/,          // exposed variables
      /_test$/,             // test packages
      /\/init$/,            // initialization
      /database\/sql/,      // driver registration
      /image\//,            // image format registration
    ];

    return sideEffectPatterns.some(pattern =>
      pattern.test(importInfo.module)
    );
  }

  getExplanation(diagnostic: vscode.Diagnostic, importInfo: ImportInfo): string {
    let reason = 'Unknown';

    const message = diagnostic.message.toLowerCase();

    if (message.includes('not used') || message.includes('imported but not used')) {
      reason = 'Package imported but no symbols referenced';
    } else if (message.includes('imported and not used')) {
      reason = 'Import declared but package never accessed';
    }

    const hasSideEffects = this.hasSideEffects(importInfo);
    const symbolsText = importInfo.symbols.length > 0
      ? `'${importInfo.symbols.join(', ')}'`
      : `'${importInfo.module}'`;

    return `Import ${symbolsText} is unused
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason}
Source: ${diagnostic.source || 'gopls'}
Side effects: ${hasSideEffects ? 'Yes (will be preserved in Safe Mode)' : 'No'}
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
   * Organize Go imports: stdlib first, then third-party, each group sorted.
   * Outputs a single canonical import(...) block.
   */
  organizeImports(content: string): string | null {
    const lines = content.split('\n');
    let firstImportLine = -1;
    let lastImportLine = -1;
    let inImportBlock = false;

    interface GoImportSpec {
      raw: string;       // original indented text
      path: string;      // bare import path without quotes
      alias?: string;    // alias or blank-import marker
      isBlank: boolean;  // _ imports
    }

    const specs: GoImportSpec[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (trimmed === 'import (') {
        firstImportLine = i;
        inImportBlock = true;
        continue;
      }

      if (inImportBlock) {
        if (trimmed === ')') {
          lastImportLine = i;
          inImportBlock = false;
          continue;
        }
        if (!trimmed || trimmed.startsWith('//')) continue;

        const blank = trimmed.startsWith('_');
        const aliasMatch = trimmed.match(/^(\w+)\s+"([^"]+)"/);
        const pathMatch = trimmed.match(/^"([^"]+)"/);

        if (aliasMatch) {
          specs.push({ raw: trimmed, path: aliasMatch[2], alias: aliasMatch[1], isBlank: false });
        } else if (pathMatch) {
          specs.push({ raw: trimmed, path: pathMatch[1], isBlank: blank });
        }
        continue;
      }

      // Single-line import: import "fmt"
      const singleMatch = lines[i].match(/^import\s+(?:(\w+|\.|_)\s+)?"([^"]+)"/);
      if (singleMatch) {
        if (firstImportLine === -1) firstImportLine = i;
        lastImportLine = i;
        const alias = singleMatch[1];
        specs.push({
          raw: singleMatch[0],
          path: singleMatch[2],
          alias: alias && alias !== '.' ? alias : undefined,
          isBlank: alias === '_',
        });
      }
    }

    if (specs.length === 0 || firstImportLine === -1) return null;

    // Separate stdlib (no dot) from third-party
    const stdlib: GoImportSpec[] = [];
    const thirdParty: GoImportSpec[] = [];

    for (const spec of specs) {
      if (!spec.path.includes('.')) {
        stdlib.push(spec);
      } else {
        thirdParty.push(spec);
      }
    }

    const formatSpec = (s: GoImportSpec): string => {
      if (s.isBlank) return `\t_ "${s.path}"`;
      if (s.alias) return `\t${s.alias} "${s.path}"`;
      return `\t"${s.path}"`;
    };

    stdlib.sort((a, b) => a.path.localeCompare(b.path));
    thirdParty.sort((a, b) => a.path.localeCompare(b.path));

    const groups = [stdlib, thirdParty].filter(g => g.length > 0);
    const inner = groups.map(g => g.map(formatSpec).join('\n')).join('\n\n');
    const organized = `import (\n${inner}\n)`;

    const before = lines.slice(0, firstImportLine).join('\n');
    const after = lines.slice(lastImportLine + 1).join('\n');

    return [before, organized, after].filter(p => p.trim() !== '').join('\n\n');
  }
}
