#!/usr/bin/env node

/**
 * ImportLens CLI - Headless import analyzer for CI/CD environments
 *
 * Usage:
 *   importlens-cli [options] [files...]
 *
 * Examples:
 *   importlens-cli src/
 *   importlens-cli --check --format=github src/
 *   importlens-cli --fix --safe-mode src/
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from './cli/ArgumentParser';
import { FileDiscovery } from './cli/FileDiscovery';
import { CLIAnalyzer } from './cli/CLIAnalyzer';
import { OutputFormatter } from './cli/OutputFormatter';

async function main() {
  try {
    // Parse command-line arguments
    const args = parseArgs(process.argv.slice(2));

    // Show help if requested
    if (args.help) {
      showHelp();
      process.exit(0);
    }

    // Show version if requested
    if (args.version) {
      showVersion();
      process.exit(0);
    }

    // Discover files to analyze
    const discovery = new FileDiscovery(args);
    const files = await discovery.discoverFiles();

    if (files.length === 0) {
      console.error('No files found to analyze');
      process.exit(1);
    }

    // Initialize analyzer
    const analyzer = new CLIAnalyzer(args);

    // Process files
    const results = await analyzer.analyzeFiles(files);

    // Format and output results
    const formatter = new OutputFormatter(args.format);
    const output = formatter.format(results);

    console.log(output);

    // Exit with appropriate code
    const hasIssues = results.some(r => r.unusedImports.length > 0);

    if (args.check && hasIssues) {
      process.exit(1); // Fail CI if issues found in check mode
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
ImportLens CLI - Unused Import Analyzer for CI/CD

USAGE:
  importlens-cli [OPTIONS] [FILES...]

OPTIONS:
  --check              Check for unused imports without fixing (exit 1 if found)
  --fix                Automatically fix unused imports
  --safe-mode          Preserve side-effect imports (default: true)
  --aggressive         Remove all unused imports including side-effects
  --format=<type>      Output format: text, json, github, junit (default: text)
  --config=<file>      Path to configuration file (.importlensrc.json)
  --exclude=<pattern>  Glob pattern to exclude files (can be used multiple times)
  --help               Show this help message
  --version            Show version information

EXAMPLES:
  # Check TypeScript files
  importlens-cli --check src/**/*.ts

  # Fix unused imports with safe mode
  importlens-cli --fix --safe-mode src/

  # GitHub Actions format for annotations
  importlens-cli --check --format=github .

  # JSON output for custom processing
  importlens-cli --check --format=json src/ > report.json

CONFIGURATION:
  Create .importlensrc.json in your project root:
  {
    "safeMode": true,
    "excludePatterns": ["**/node_modules/**", "**/dist/**"],
    "excludedLanguages": ["markdown"]
  }

EXIT CODES:
  0 - Success (no unused imports or successfully fixed)
  1 - Failure (unused imports found in check mode or error occurred)
`);
}

function showVersion() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
  );
  console.log(`ImportLens CLI v${packageJson.version}`);
}

// Run CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
