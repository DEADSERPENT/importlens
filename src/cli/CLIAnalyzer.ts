import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isMainThread, Worker } from 'worker_threads';
import { CLIArguments } from './ArgumentParser';
import { ASTAnalyzer } from './ASTAnalyzer';
import { TreeSitterAnalyzer } from './TreeSitterAnalyzer';

export interface AnalysisResult {
  filePath: string;
  language: string;
  unusedImports: UnusedImport[];
  error?: string;
}

export interface UnusedImport {
  line: number;
  importStatement: string;
  symbols: string[];
  reason: string;
}

// Minimum number of files to justify spawning worker threads
const WORKER_THRESHOLD = 8;

export class CLIAnalyzer {
  private astAnalyzer: ASTAnalyzer;
  private treeSitterAnalyzer: TreeSitterAnalyzer;

  constructor(private args: CLIArguments) {
    this.astAnalyzer = new ASTAnalyzer();
    this.treeSitterAnalyzer = new TreeSitterAnalyzer();
  }

  /**
   * Analyze multiple files for unused imports.
   * Uses worker threads for large file sets when running in the main thread.
   */
  async analyzeFiles(files: string[]): Promise<AnalysisResult[]> {
    if (isMainThread && files.length >= WORKER_THRESHOLD) {
      try {
        return await this.analyzeFilesParallel(files);
      } catch (err) {
        // Graceful degradation: fall through to sequential processing
        if (this.args.format !== 'json') {
          console.error('[Workers] Parallel processing unavailable, falling back to sequential:', err);
        }
      }
    }

    const results: AnalysisResult[] = [];
    for (const file of files) {
      results.push(await this.analyzeFile(file));
    }
    return results;
  }

  /**
   * Distribute files across CPU-count worker threads for maximum throughput.
   */
  private async analyzeFilesParallel(files: string[]): Promise<AnalysisResult[]> {
    const cpuCount = os.cpus().length;
    const workerCount = Math.min(cpuCount, Math.ceil(files.length / 2));
    const chunkSize = Math.ceil(files.length / workerCount);

    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += chunkSize) {
      chunks.push(files.slice(i, i + chunkSize));
    }

    // Resolve path relative to the compiled output directory
    const workerPath = path.join(__dirname, 'AnalyzerWorker.js');

    const workerPromises = chunks.map(
      chunk =>
        new Promise<AnalysisResult[]>((resolve, reject) => {
          const worker = new Worker(workerPath, {
            workerData: { files: chunk, args: this.args },
          });
          worker.once('message', (results: AnalysisResult[]) => resolve(results));
          worker.once('error', reject);
          worker.once('exit', code => {
            if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
          });
        })
    );

    const results = await Promise.all(workerPromises);
    return results.flat();
  }

  /**
   * Analyze a single file for unused imports
   */
  private async analyzeFile(filePath: string): Promise<AnalysisResult> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const language = this.detectLanguage(filePath);
      const unusedImports = this.findUnusedImports(content, language, filePath);

      return { filePath, language, unusedImports };
    } catch (error) {
      return {
        filePath,
        language: 'unknown',
        unusedImports: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * Find unused imports in file content.
   * Priority: Babel AST (TS/JS) > Tree-sitter > regex heuristics.
   */
  private findUnusedImports(
    content: string,
    language: string,
    filePath: string
  ): UnusedImport[] {
    const lines = content.split('\n');

    switch (language) {
      case 'typescript':
      case 'typescriptreact':
      case 'javascript':
      case 'javascriptreact':
        return this.analyzeTypeScriptWithAST(content, lines, filePath);

      case 'python':
        if (this.treeSitterAnalyzer.canHandle('python')) {
          return this.treeSitterAnalyzer.analyzeFile(content, 'python', filePath);
        }
        return this.analyzePythonImports(lines, content);

      case 'java':
        if (this.treeSitterAnalyzer.canHandle('java')) {
          return this.treeSitterAnalyzer.analyzeFile(content, 'java', filePath);
        }
        return this.analyzeJavaImports(lines, content);

      case 'go':
        if (this.treeSitterAnalyzer.canHandle('go')) {
          return this.treeSitterAnalyzer.analyzeFile(content, 'go', filePath);
        }
        return this.analyzeGoImports(lines, content);

      case 'rust':
        if (this.treeSitterAnalyzer.canHandle('rust')) {
          return this.treeSitterAnalyzer.analyzeFile(content, 'rust', filePath);
        }
        return this.analyzeRustImports(lines, content);

      case 'cpp':
      case 'c':
        return this.analyzeCppImports(lines, content);

      default:
        return [];
    }
  }

  /**
   * Analyze TypeScript/JavaScript imports using AST parsing
   * Provides 100% accuracy compared to regex-based approach
   */
  private analyzeTypeScriptWithAST(content: string, lines: string[], filePath: string): UnusedImport[] {
    try {
      const result = this.astAnalyzer.analyzeTypeScriptFile(content, filePath);

      return result.unusedImports.map(astUnused => {
        const importStatement = lines[astUnused.line - 1]?.trim() || '';
        return {
          line: astUnused.line,
          importStatement,
          symbols: astUnused.unusedSpecifiers,
          reason:
            astUnused.unusedSpecifiers.length === astUnused.allSpecifiers.length
              ? `All imports from '${astUnused.source}' are unused`
              : `Unused: ${astUnused.unusedSpecifiers.join(', ')} from '${astUnused.source}'`,
        };
      });
    } catch (error) {
      console.error(`AST parsing failed for ${filePath}, falling back to regex:`, error);
      return this.analyzeTypeScriptImportsRegex(lines, content);
    }
  }

  /**
   * Fallback regex-based TypeScript/JavaScript analysis
   */
  private analyzeTypeScriptImportsRegex(lines: string[], content: string): UnusedImport[] {
    const unused: UnusedImport[] = [];
    const importRegex = /^import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const match = trimmed.match(importRegex);

      if (match) {
        const namedImports = match[1] ? match[1].split(',').map(s => s.trim()) : [];
        const defaultImport = match[2];
        const symbols = [...namedImports, defaultImport].filter(Boolean);

        const unusedSymbols = symbols.filter(symbol => {
          const codeWithoutImports = lines.filter((_, i) => i !== index).join('\n');
          const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g');
          const matches = codeWithoutImports.match(symbolRegex);
          return !matches || matches.length === 0;
        });

        if (unusedSymbols.length > 0) {
          unused.push({
            line: index + 1,
            importStatement: trimmed,
            symbols: unusedSymbols,
            reason: `Symbol(s) ${unusedSymbols.join(', ')} not used in code`,
          });
        }
      }
    });

    return unused;
  }

  /**
   * Regex-based Python import analysis (fallback when tree-sitter is unavailable)
   */
  private analyzePythonImports(lines: string[], content: string): UnusedImport[] {
    const unused: UnusedImport[] = [];
    const importRegex = /^(?:from\s+\S+\s+)?import\s+(.+)/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const match = trimmed.match(importRegex);

      if (match) {
        const imports = match[1].split(',').map(s => s.trim().split(' as ')[0]);

        const unusedSymbols = imports.filter(symbol => {
          const codeWithoutImports = lines.filter((_, i) => i !== index).join('\n');
          const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g');
          const matches = codeWithoutImports.match(symbolRegex);
          return !matches || matches.length === 0;
        });

        if (unusedSymbols.length > 0) {
          unused.push({
            line: index + 1,
            importStatement: trimmed,
            symbols: unusedSymbols,
            reason: `Symbol(s) ${unusedSymbols.join(', ')} not used in code`,
          });
        }
      }
    });

    return unused;
  }

  /**
   * Regex-based Java import analysis (fallback when tree-sitter is unavailable)
   */
  private analyzeJavaImports(lines: string[], content: string): UnusedImport[] {
    const unused: UnusedImport[] = [];
    const importRegex = /^import\s+(?:static\s+)?([a-zA-Z0-9_.]+(?:\.\*)?);/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const match = trimmed.match(importRegex);

      if (match) {
        const importPath = match[1];
        const className = importPath.split('.').pop() || '';

        if (className !== '*') {
          const codeWithoutImports = lines.filter((_, i) => i !== index).join('\n');
          const classRegex = new RegExp(`\\b${className}\\b`, 'g');
          const matches = codeWithoutImports.match(classRegex);

          if (!matches || matches.length === 0) {
            unused.push({
              line: index + 1,
              importStatement: trimmed,
              symbols: [className],
              reason: `Class ${className} not used in code`,
            });
          }
        }
      }
    });

    return unused;
  }

  /**
   * Regex-based Go import analysis (fallback when tree-sitter is unavailable)
   */
  private analyzeGoImports(lines: string[], content: string): UnusedImport[] {
    const unused: UnusedImport[] = [];
    const importRegex = /^\s*(?:"([^"]+)"|(\w+)\s+"([^"]+)")/;

    let inImportBlock = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed === 'import (') { inImportBlock = true; return; }
      if (trimmed === ')' && inImportBlock) { inImportBlock = false; return; }

      if (trimmed.startsWith('import ') || inImportBlock) {
        const match = trimmed.match(importRegex);
        if (match) {
          const packagePath = match[1] || match[3];
          const alias = match[2] || packagePath.split('/').pop();

          if (alias) {
            const codeWithoutImports = lines.filter((_, i) => i !== index).join('\n');
            const pkgRegex = new RegExp(`\\b${alias}\\.`, 'g');
            const matches = codeWithoutImports.match(pkgRegex);

            if (!matches || matches.length === 0) {
              unused.push({
                line: index + 1,
                importStatement: trimmed,
                symbols: [alias],
                reason: `Package ${alias} not used in code`,
              });
            }
          }
        }
      }
    });

    return unused;
  }

  /**
   * Regex-based Rust import analysis (fallback when tree-sitter is unavailable)
   */
  private analyzeRustImports(lines: string[], content: string): UnusedImport[] {
    const unused: UnusedImport[] = [];
    const useRegex = /^use\s+([^;]+);/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const match = trimmed.match(useRegex);

      if (match) {
        const importPath = match[1];
        const symbols = importPath.includes('{')
          ? importPath.match(/{([^}]+)}/)?.[1].split(',').map(s => s.trim()) || []
          : [importPath.split('::').pop()?.trim() || ''];

        const unusedSymbols = symbols.filter(symbol => {
          const codeWithoutImports = lines.filter((_, i) => i !== index).join('\n');
          const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g');
          const matches = codeWithoutImports.match(symbolRegex);
          return !matches || matches.length === 0;
        });

        if (unusedSymbols.length > 0) {
          unused.push({
            line: index + 1,
            importStatement: trimmed,
            symbols: unusedSymbols,
            reason: `Symbol(s) ${unusedSymbols.join(', ')} not used in code`,
          });
        }
      }
    });

    return unused;
  }

  /**
   * C/C++ include analysis
   */
  private analyzeCppImports(lines: string[], content: string): UnusedImport[] {
    const unused: UnusedImport[] = [];
    const includeRegex = /^#include\s+[<"]([^>"]+)[>"]/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const match = trimmed.match(includeRegex);

      if (match) {
        const header = match[1];
        // Derive likely identifier from header name (e.g. stdio.h -> stdio, vector -> vector)
        const symbol = header.replace(/\.h(pp)?$/, '').split('/').pop() || header;

        // Skip common headers that are always used via macros/types without a symbol reference
        const alwaysUsed = ['stdio', 'stdlib', 'string', 'stddef', 'stdint', 'stdbool'];
        if (alwaysUsed.includes(symbol)) return;

        const codeWithoutIncludes = lines.filter((_, i) => i !== index).join('\n');
        const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g');
        const matches = codeWithoutIncludes.match(symbolRegex);

        if (!matches || matches.length === 0) {
          unused.push({
            line: index + 1,
            importStatement: trimmed,
            symbols: [symbol],
            reason: `Header <${header}> may be unused`,
          });
        }
      }
    });

    return unused;
  }
}
