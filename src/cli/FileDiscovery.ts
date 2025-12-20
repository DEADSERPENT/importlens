import * as path from 'path';
import fg from 'fast-glob';
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
   * Uses fast-glob for production-grade glob matching
   */
  async discoverFiles(): Promise<string[]> {
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

    // Build patterns to search
    let searchPatterns: string[];

    if (this.args.files.length === 0) {
      // Default: search current directory for all supported file types
      searchPatterns = this.supportedExtensions.map(ext => `**/*${ext}`);
    } else {
      // User provided patterns - expand them
      searchPatterns = this.expandUserPatterns(this.args.files);
    }

    // Use fast-glob for efficient, reliable file discovery
    const files = await fg(searchPatterns, {
      ignore: allExclusions,
      onlyFiles: true,
      absolute: true,
      dot: false,
      cwd: process.cwd(),
      suppressErrors: true // Don't throw on permission errors
    });

    return files;
  }

  /**
   * Expand user-provided patterns to handle directories and specific files
   */
  private expandUserPatterns(userPatterns: string[]): string[] {
    const expandedPatterns: string[] = [];

    for (const pattern of userPatterns) {
      const resolved = path.resolve(process.cwd(), pattern);

      // If pattern is a directory, expand to all supported extensions
      if (pattern.endsWith('/') || pattern.endsWith('\\') || !path.extname(pattern)) {
        const normalized = pattern.replace(/\\/g, '/').replace(/\/$/, '');
        this.supportedExtensions.forEach(ext => {
          expandedPatterns.push(`${normalized}/**/*${ext}`);
        });
      } else {
        // It's a file pattern or glob - use as-is
        expandedPatterns.push(pattern.replace(/\\/g, '/'));
      }
    }

    return expandedPatterns;
  }

}
