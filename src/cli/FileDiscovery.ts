import * as fs from 'fs';
import * as path from 'path';
import { CLIArguments } from './ArgumentParser';

export class FileDiscovery {
  private readonly supportedExtensions = [
    '.ts', '.tsx', '.js', '.jsx',
    '.py',
    '.java',
    '.go',
    '.rs',
    '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'
  ];

  constructor(private args: CLIArguments) {}

  /**
   * Discover files to analyze based on patterns and exclusions
   */
  async discoverFiles(): Promise<string[]> {
    const files: Set<string> = new Set();

    // If no files specified, default to current directory
    const patterns = this.args.files.length > 0 ? this.args.files : ['.'];

    for (const pattern of patterns) {
      const discovered = await this.expandPattern(pattern);
      discovered.forEach(f => files.add(f));
    }

    // Filter out excluded files
    return Array.from(files).filter(file => !this.isExcluded(file));
  }

  /**
   * Expand a file pattern (glob or directory)
   */
  private async expandPattern(pattern: string): Promise<string[]> {
    const resolved = path.resolve(process.cwd(), pattern);

    // Check if it's a file
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return this.isSupportedFile(resolved) ? [resolved] : [];
    }

    // Check if it's a directory
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return this.walkDirectory(resolved);
    }

    // Try to match as glob pattern
    return this.matchGlob(pattern);
  }

  /**
   * Recursively walk directory and find supported files
   */
  private walkDirectory(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (this.isExcluded(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          files.push(...this.walkDirectory(fullPath));
        } else if (entry.isFile() && this.isSupportedFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Cannot read directory ${dir}: ${error}`);
    }

    return files;
  }

  /**
   * Match glob pattern (basic implementation)
   */
  private matchGlob(pattern: string): string[] {
    // For now, just expand directories
    // In a production version, you'd use a proper glob library like 'fast-glob'
    const basePath = this.extractBasePath(pattern);

    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      const allFiles = this.walkDirectory(basePath);
      return allFiles.filter(file => this.matchPattern(file, pattern));
    }

    return [];
  }

  /**
   * Extract base path from glob pattern
   */
  private extractBasePath(pattern: string): string {
    // Remove glob wildcards to get base directory
    const withoutGlobs = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
    const lastSlash = Math.max(
      withoutGlobs.lastIndexOf('/'),
      withoutGlobs.lastIndexOf('\\')
    );

    if (lastSlash > 0) {
      return withoutGlobs.substring(0, lastSlash);
    }

    return '.';
  }

  /**
   * Match file against pattern
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    const regex = this.globToRegex(pattern);
    return regex.test(normalized);
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(pattern: string): RegExp {
    let regexPattern = pattern
      .replace(/\\/g, '/')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Check if file is supported based on extension
   */
  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Check if file should be excluded
   */
  private isExcluded(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    // Default exclusions
    const defaultExclusions = [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/build/**',
      '**/.git/**',
      '**/*.min.js',
      '**/*.min.css'
    ];

    const allExclusions = [...defaultExclusions, ...this.args.exclude];

    return allExclusions.some(pattern => {
      const regex = this.globToRegex(pattern);
      return regex.test(normalized);
    });
  }
}
