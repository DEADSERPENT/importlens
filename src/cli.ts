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
import { BaselineManager } from './cli/BaselineManager';

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

    // Initialize baseline manager
    const baselineManager = new BaselineManager(args.baseline);

    // Handle baseline operations
    if (args.baselineGenerate) {
      const baseline = baselineManager.generateBaseline(results);
      baselineManager.saveBaseline(baseline);
      process.exit(0);
    }

    if (args.baselineUpdate) {
      baselineManager.updateBaseline(results);
      process.exit(0);
    }

    if (args.baselineCheck || baselineManager.baselineExists()) {
      const baseline = baselineManager.loadBaseline();

      if (!baseline) {
        console.log('⚠️  No baseline found. Run with --baseline-generate to create one.');
        console.log('   Continuing with standard analysis...\n');
      } else {
        // Compare against baseline
        const comparison = baselineManager.compareWithBaseline(results, baseline);
        baselineManager.printComparisonSummary(comparison);

        // Exit with error code if new issues found
        if (args.check && comparison.summary.totalNew > 0) {
          console.log('\n❌ New unused imports detected beyond baseline!');
          process.exit(1);
        }

        if (comparison.summary.totalNew === 0) {
          console.log('\n✓ All checks passed!');
          process.exit(0);
        }
      }
    }

    // Format and output results (if not using baseline mode)
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

BASELINE OPTIONS (for CI/CD):
  --baseline=<file>         Path to baseline file (default: .importlens-baseline.json)
  --baseline-generate       Generate a new baseline from current results
  --baseline-update         Update existing baseline with current results
  --baseline-check          Check for new issues beyond baseline (auto-enabled if baseline exists)

EXAMPLES:
  # Check TypeScript files
  importlens-cli --check src/**/*.ts

  # Fix unused imports with safe mode
  importlens-cli --fix --safe-mode src/

  # GitHub Actions format for annotations
  importlens-cli --check --format=github .

  # JSON output for custom processing
  importlens-cli --check --format=json src/ > report.json

  # Baseline workflow for CI/CD:
  # 1. Generate baseline to capture current technical debt
  importlens-cli --baseline-generate src/

  # 2. In CI, check for NEW issues beyond baseline
  importlens-cli --check src/  # Auto-detects baseline

  # 3. Update baseline when intentionally accepting new debt
  importlens-cli --baseline-update src/

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
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
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
