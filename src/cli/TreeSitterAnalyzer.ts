import { UnusedImport } from './CLIAnalyzer';

interface ParsedImport {
  line: number;
  symbols: string[];
  text: string;
}

/**
 * Tree-sitter based AST analyzer for Python, Java, Go, and Rust.
 * Loads grammars lazily; falls back gracefully when packages are absent.
 */
export class TreeSitterAnalyzer {
  private parsers = new Map<string, any>();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    let TSParser: any;
    try {
      TSParser = require('tree-sitter');
    } catch {
      return; // tree-sitter not installed
    }

    const grammars: Record<string, string> = {
      python: 'tree-sitter-python',
      java: 'tree-sitter-java',
      go: 'tree-sitter-go',
      rust: 'tree-sitter-rust',
    };

    for (const [lang, pkg] of Object.entries(grammars)) {
      try {
        const grammar = require(pkg);
        const p = new TSParser();
        p.setLanguage(grammar);
        this.parsers.set(lang, p);
      } catch {
        // Grammar package not installed — CLI falls back to regex for this language
      }
    }
  }

  canHandle(language: string): boolean {
    return this.parsers.has(language);
  }

  analyzeFile(content: string, language: string, filePath: string): UnusedImport[] {
    const parser = this.parsers.get(language);
    if (!parser) return [];

    try {
      const tree = parser.parse(content);
      const lines = content.split('\n');
      const importNodeTypes = this.getImportNodeTypes(language);

      const importNodes = this.findImportNodes(tree.rootNode, importNodeTypes);
      const usedIdentifiers = this.collectUsedIdentifiers(tree.rootNode, importNodeTypes);
      const parsedImports = importNodes
        .map(n => this.parseImportNode(n, language, lines))
        .filter((imp): imp is ParsedImport => imp !== null);

      return parsedImports.flatMap(imp => {
        const unusedSymbols = imp.symbols.filter(s => s !== '*' && !usedIdentifiers.has(s));
        if (unusedSymbols.length === 0) return [];
        return [{
          line: imp.line,
          importStatement: imp.text,
          symbols: unusedSymbols,
          reason: `Symbol(s) ${unusedSymbols.join(', ')} not used in code`,
        }];
      });
    } catch (err) {
      console.error(`[TreeSitter] Analysis failed for ${filePath}:`, err);
      return [];
    }
  }

  private getImportNodeTypes(language: string): string[] {
    const typeMap: Record<string, string[]> = {
      python: ['import_statement', 'import_from_statement'],
      java: ['import_declaration'],
      go: ['import_declaration'],
      rust: ['use_declaration'],
    };
    return typeMap[language] || [];
  }

  private findImportNodes(rootNode: any, importTypes: string[]): any[] {
    const found: any[] = [];
    const walk = (node: any) => {
      if (importTypes.includes(node.type)) {
        found.push(node);
        return; // Don't descend into import nodes
      }
      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i));
      }
    };
    walk(rootNode);
    return found;
  }

  /**
   * Collect all identifier nodes outside of import declarations.
   * Tree-sitter guarantees identifiers inside strings/comments are excluded.
   */
  private collectUsedIdentifiers(rootNode: any, importNodeTypes: string[]): Set<string> {
    const identifiers = new Set<string>();
    const walk = (node: any) => {
      if (importNodeTypes.includes(node.type)) return; // skip import subtrees
      if (node.type === 'identifier' || node.type === 'type_identifier') {
        identifiers.add(node.text);
      }
      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i));
      }
    };
    walk(rootNode);
    return identifiers;
  }

  private parseImportNode(node: any, language: string, lines: string[]): ParsedImport | null {
    const lineNum = node.startPosition.row + 1;
    const text = lines[lineNum - 1]?.trim() || node.text.split('\n')[0].trim();
    // Normalize whitespace for multi-line imports
    const rawText = node.text.replace(/\s+/g, ' ').trim();

    let symbols: string[] = [];
    switch (language) {
      case 'python': symbols = this.extractPythonSymbols(rawText); break;
      case 'java':   symbols = this.extractJavaSymbols(rawText);   break;
      case 'go':     symbols = this.extractGoSymbols(node);         break;
      case 'rust':   symbols = this.extractRustSymbols(rawText);    break;
    }

    if (symbols.length === 0) return null;
    return { line: lineNum, symbols, text };
  }

  // ── Language-specific symbol extraction ─────────────────────────────────

  private extractPythonSymbols(text: string): string[] {
    const fromMatch = text.match(/^from\s+[\w.]+\s+import\s+(.+)$/);
    if (fromMatch) {
      const importPart = fromMatch[1].replace(/[()]/g, '').trim();
      if (importPart === '*') return ['*'];
      return importPart.split(',').map(s => {
        const aliasMatch = s.trim().match(/\S+\s+as\s+(\S+)/);
        return aliasMatch ? aliasMatch[1] : s.trim().split('.')[0];
      }).filter(Boolean);
    }

    const importMatch = text.match(/^import\s+(.+)$/);
    if (importMatch) {
      return importMatch[1].split(',').map(s => {
        const aliasMatch = s.trim().match(/\S+\s+as\s+(\S+)/);
        return aliasMatch ? aliasMatch[1] : s.trim().split('.')[0];
      }).filter(Boolean);
    }

    return [];
  }

  private extractJavaSymbols(text: string): string[] {
    const match = text.match(/^import\s+(?:static\s+)?([\w.*]+)\s*;?$/);
    if (!match) return [];
    const importPath = match[1];
    if (importPath.endsWith('.*')) return ['*'];
    return [importPath.split('.').pop() || importPath];
  }

  private extractGoSymbols(node: any): string[] {
    const symbols: string[] = [];
    const nodeText = node.text;

    if (!nodeText.includes('(')) {
      // Single import: import [alias] "path"
      if (/import\s+_\s+"/.test(nodeText)) return []; // blank import
      const m = nodeText.match(/import\s+(?:(\w+|\.|_)\s+)?"([^"]+)"/);
      if (!m) return [];
      const alias = m[1];
      const pkgPath = m[2];
      if (alias === '.' || alias === '_') return [];
      symbols.push(alias || pkgPath.split('/').pop() || pkgPath);
      return symbols;
    }

    // Grouped: import ( ... )
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type !== 'import_spec') continue;
      const spec = child.text.trim();
      if (spec.startsWith('_') || spec.startsWith('.')) continue;
      const aliasMatch = spec.match(/^(\w+)\s+"[^"]+"/);
      if (aliasMatch) { symbols.push(aliasMatch[1]); continue; }
      const pathMatch = spec.match(/"([^"]+)"/);
      if (pathMatch) symbols.push(pathMatch[1].split('/').pop() || pathMatch[1]);
    }
    return symbols;
  }

  private extractRustSymbols(text: string): string[] {
    const match = text.match(/^use\s+([^;]+);?$/);
    if (!match) return [];
    const path = match[1].trim();

    if (path.endsWith('*')) return ['*'];

    // use std::{io, fs, collections::HashMap};
    if (path.includes('{')) {
      const braceMatch = path.match(/\{([^}]+)\}/);
      if (braceMatch) {
        return braceMatch[1].split(',').map(s => {
          const part = s.trim();
          // handle `OldName as NewName`
          const asMatch = part.match(/\s+as\s+(\w+)/);
          if (asMatch) return asMatch[1];
          return part.split('::').pop()?.trim() || part;
        }).filter(Boolean);
      }
    }

    // use std::io::Write as IoWrite;
    const asMatch = path.match(/\s+as\s+(\w+)$/);
    if (asMatch) return [asMatch[1]];

    // use std::io::Write;
    return [path.split('::').pop()?.trim() || path].filter(Boolean);
  }
}
