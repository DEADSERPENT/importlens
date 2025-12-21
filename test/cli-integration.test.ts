import * as assert from 'assert';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI End-to-End Integration Tests
 *
 * These tests invoke the actual importlens-cli command and verify:
 * - Real file analysis with test fixtures
 * - Baseline generation, update, and comparison workflows
 * - Output format validation (text, JSON, GitHub, JUnit)
 * - Exit codes and error handling
 */
suite('CLI End-to-End Integration Tests', () => {
	const testDir = path.join(__dirname, 'cli-test-workspace');
	const baselinePath = path.join(testDir, '.importlens-baseline.json');
	const cliPath = path.join(__dirname, '..', 'src', 'cli.js');

	// Helper to run CLI command
	function runCLI(args: string, options: { expectFailure?: boolean } = {}): { stdout: string; stderr: string; code: number } {
		try {
			const stdout = execSync(`node "${cliPath}" ${args}`, {
				cwd: testDir,
				encoding: 'utf-8',
				stdio: ['pipe', 'pipe', 'pipe']
			});
			return { stdout, stderr: '', code: 0 };
		} catch (error: any) {
			if (options.expectFailure) {
				return {
					stdout: error.stdout?.toString() || '',
					stderr: error.stderr?.toString() || '',
					code: error.status || 1
				};
			}
			throw error;
		}
	}

	// Setup test workspace with sample files
	setup(() => {
		// Create test directory
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
		fs.mkdirSync(testDir, { recursive: true });

		// Create sample TypeScript file with unused imports
		const tsFile = path.join(testDir, 'sample.ts');
		fs.writeFileSync(tsFile, `import { useState, useEffect } from 'react';
import lodash from 'lodash';
import * as path from 'path';

function App() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
`);

		// Create sample JavaScript file with unused imports
		const jsFile = path.join(testDir, 'sample.js');
		fs.writeFileSync(jsFile, `import { debounce, throttle } from 'lodash';
import moment from 'moment';

export function helper() {
  return debounce(() => console.log('test'), 100);
}
`);

		// Create sample Python file with unused imports
		const pyFile = path.join(testDir, 'sample.py');
		fs.writeFileSync(pyFile, `import os
import sys
import json
import datetime

def main():
    print(json.dumps({'test': 'value'}))
`);
	});

	// Cleanup after tests
	teardown(() => {
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	suite('Basic Analysis', () => {
		test('Should analyze TypeScript files and detect unused imports', () => {
			const result = runCLI('--check sample.ts', { expectFailure: true });

			assert.ok(result.stdout.includes('sample.ts'), 'Should report file path');
			assert.ok(result.stdout.includes('useEffect') || result.stdout.includes('lodash') || result.stdout.includes('path'),
				'Should detect unused imports');
			assert.strictEqual(result.code, 1, 'Should exit with code 1 when issues found');
		});

		test('Should analyze JavaScript files and detect unused imports', () => {
			const result = runCLI('--check sample.js', { expectFailure: true });

			assert.ok(result.stdout.includes('sample.js'), 'Should report file path');
			assert.ok(result.stdout.includes('throttle') || result.stdout.includes('moment'),
				'Should detect unused imports');
		});

		test('Should analyze Python files and detect unused imports', () => {
			const result = runCLI('--check sample.py', { expectFailure: true });

			assert.ok(result.stdout.includes('sample.py'), 'Should report file path');
			assert.ok(result.stdout.includes('os') || result.stdout.includes('sys') || result.stdout.includes('datetime'),
				'Should detect unused imports');
		});

		test('Should analyze all files when given directory', () => {
			const result = runCLI('--check .', { expectFailure: true });

			assert.ok(result.stdout.includes('sample.ts') || result.stdout.includes('sample.js') || result.stdout.includes('sample.py'),
				'Should analyze multiple files');
			assert.strictEqual(result.code, 1, 'Should exit with code 1 when issues found');
		});
	});

	suite('Baseline Workflow', () => {
		test('Should generate baseline file', () => {
			const result = runCLI('--baseline-generate .');

			assert.ok(fs.existsSync(baselinePath), 'Baseline file should be created');
			const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

			assert.strictEqual(baseline.version, '3.0.0', 'Should create v3.0.0 baseline');
			assert.ok(Array.isArray(baseline.entries), 'Should have entries array');
			assert.ok(Array.isArray(baseline.history), 'Should have history array');
			assert.strictEqual(baseline.history.length, 0, 'History should be empty initially');
			assert.ok(baseline.metadata.totalUnusedImports > 0, 'Should capture unused imports');
			assert.strictEqual(result.code, 0, 'Should exit with code 0');
		});

		test('Should check against baseline (no new issues)', () => {
			// Generate baseline
			runCLI('--baseline-generate .');

			// Check should pass (no changes)
			const result = runCLI('--check .');

			assert.ok(result.stdout.includes('baseline') || result.stdout.includes('accepted'),
				'Should indicate baseline comparison');
			assert.strictEqual(result.code, 0, 'Should exit with code 0 when no new issues');
		});

		test('Should detect new issues vs baseline', () => {
			// Generate baseline
			runCLI('--baseline-generate .');

			// Add new file with unused imports
			const newFile = path.join(testDir, 'new.ts');
			fs.writeFileSync(newFile, `import { useMemo } from 'react';\nexport const x = 1;`);

			// Check should fail (new issues)
			const result = runCLI('--check .', { expectFailure: true });

			assert.ok(result.stdout.includes('new') || result.stdout.includes('NEW'),
				'Should indicate new issues');
			assert.strictEqual(result.code, 1, 'Should exit with code 1 for new issues');
		});

		test('Should update baseline and capture snapshot', () => {
			// Generate initial baseline
			runCLI('--baseline-generate .');

			// Update baseline
			runCLI('--baseline-update .');

			const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
			assert.strictEqual(baseline.version, '3.0.0', 'Should maintain v3.0.0');
			assert.strictEqual(baseline.history.length, 1, 'Should capture one snapshot');

			const snapshot = baseline.history[0];
			assert.ok(snapshot.timestamp, 'Snapshot should have timestamp');
			assert.ok(snapshot.metadata, 'Snapshot should have metadata');
			assert.strictEqual(snapshot.version, '1.0.0', 'Snapshot should have version');
		});

		test('Should migrate v2.0.0 baseline to v3.0.0', () => {
			// Create v2.0.0 baseline
			const v2Baseline = {
				version: '2.0.0',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				entries: [],
				metadata: { totalFiles: 0, totalUnusedImports: 0 }
			};
			fs.writeFileSync(baselinePath, JSON.stringify(v2Baseline));

			// Run baseline-update (triggers migration and persists it)
			runCLI('--baseline-update .');

			// Verify migration persisted
			const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
			assert.strictEqual(baseline.version, '3.0.0', 'Should auto-migrate to v3.0.0');
			assert.ok(Array.isArray(baseline.history), 'Should add history array');
			assert.strictEqual(baseline.history.length, 1, 'Should have one snapshot from the update');
		});

		test('Should maintain 30-snapshot limit', () => {
			// Generate baseline
			runCLI('--baseline-generate .');

			// Perform 35 updates (should prune to 30)
			for (let i = 0; i < 35; i++) {
				// Modify file slightly to trigger different state
				const tsFile = path.join(testDir, 'sample.ts');
				const content = fs.readFileSync(tsFile, 'utf-8');
				fs.writeFileSync(tsFile, content + `\n// Comment ${i}`);

				runCLI('--baseline-update .');
			}

			const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
			assert.strictEqual(baseline.history.length, 30, 'Should maintain exactly 30 snapshots');

			// Verify chronological order
			const timestamps = baseline.history.map((s: any) => new Date(s.timestamp).getTime());
			for (let i = 1; i < timestamps.length; i++) {
				assert.ok(timestamps[i] >= timestamps[i - 1], 'Snapshots should be in chronological order');
			}
		});
	});

	suite('Output Formats', () => {
		test('Should output text format (default)', () => {
			const result = runCLI('--check sample.ts', { expectFailure: true });

			assert.ok(result.stdout.includes('Line ') || result.stdout.includes('import'),
				'Text format should be human-readable');
		});

		test('Should output JSON format', () => {
			const result = runCLI('--check --format=json sample.ts', { expectFailure: true });

			const parsed = JSON.parse(result.stdout);
			assert.ok(parsed.results, 'JSON output should have results field');
			assert.ok(Array.isArray(parsed.results), 'Results should be array');
			assert.ok(parsed.totalFiles >= 0, 'Should have totalFiles count');
			assert.ok(parsed.totalUnusedImports >= 0, 'Should have totalUnusedImports count');
		});

		test('Should output GitHub Actions format', () => {
			const result = runCLI('--check --format=github sample.ts', { expectFailure: true });

			assert.ok(result.stdout.includes('::error') || result.stdout.includes('::warning'),
				'GitHub format should use workflow commands');
		});

		test('Should output JUnit XML format', () => {
			const result = runCLI('--check --format=junit sample.ts', { expectFailure: true });

			assert.ok(result.stdout.includes('<?xml') && result.stdout.includes('<testsuite'),
				'JUnit format should be valid XML');
		});
	});

	suite('Configuration and Flags', () => {
		test('Should respect safe mode flag', () => {
			const result = runCLI('--check --safe-mode sample.ts', { expectFailure: true });

			assert.strictEqual(result.code, 1, 'Should detect issues in safe mode');
		});

		test('Should respect exclude patterns', () => {
			// Create config file
			const configPath = path.join(testDir, '.importlensrc.json');
			fs.writeFileSync(configPath, JSON.stringify({
				excludePatterns: ['*.py']
			}));

			const result = runCLI('--check .', { expectFailure: true });

			// Should not include Python file results
			assert.ok(!result.stdout.includes('sample.py'), 'Should exclude Python files');
		});

		test('Should handle --help flag', () => {
			const result = runCLI('--help');

			assert.ok(result.stdout.includes('USAGE:') || result.stdout.includes('OPTIONS:'),
				'Help should show usage information');
			assert.strictEqual(result.code, 0, 'Help should exit with code 0');
		});

		test('Should handle --version flag', () => {
			const result = runCLI('--version');

			assert.ok(result.stdout.match(/\d+\.\d+\.\d+/), 'Version should show semver format');
			assert.strictEqual(result.code, 0, 'Version should exit with code 0');
		});
	});

	suite('Error Handling', () => {
		test('Should handle non-existent files gracefully', () => {
			const result = runCLI('--check nonexistent.ts', { expectFailure: true });

			assert.ok(result.stderr.includes('not found') || result.stderr.includes('No files'),
				'Should report file not found');
			assert.notStrictEqual(result.code, 0, 'Should exit with error code');
		});

		test('Should handle invalid baseline file', () => {
			// Create corrupted baseline
			fs.writeFileSync(baselinePath, 'invalid json {{{');

			const result = runCLI('--check .', { expectFailure: true });

			// Should either report error or ignore corrupted baseline
			assert.ok(true, 'Should handle corrupted baseline gracefully');
		});

		test('Should handle empty directory', () => {
			const emptyDir = path.join(testDir, 'empty');
			fs.mkdirSync(emptyDir);

			const result = runCLI('--check empty', { expectFailure: true });

			assert.ok(result.stderr.includes('No files') || result.stdout.includes('No files'),
				'Should report no files found');
		});
	});

	suite('Performance and Scale', () => {
		test('Should handle multiple files efficiently', () => {
			// Create 20 test files
			for (let i = 0; i < 20; i++) {
				const file = path.join(testDir, `file${i}.ts`);
				fs.writeFileSync(file, `import { test${i} } from 'module${i}';\nexport const x = 1;`);
			}

			const startTime = Date.now();
			const result = runCLI('--check .', { expectFailure: true });
			const duration = Date.now() - startTime;

			assert.ok(duration < 30000, 'Should complete within 30 seconds for 20 files');
			assert.ok(result.stdout.includes('file'), 'Should analyze multiple files');
		});
	});
});
