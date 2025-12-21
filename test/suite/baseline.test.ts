import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { BaselineManager } from '../../src/cli/BaselineManager';
import type { AnalysisResult } from '../../src/cli/CLIAnalyzer';

suite('Baseline CLI Tests', () => {
	const testBaselinePath = path.join(__dirname, '.test-baseline.json');
	let baselineManager: BaselineManager;

	// Helper to create mock analysis results
	function createMockResults(numFiles: number, numImports: number): AnalysisResult[] {
		const results: AnalysisResult[] = [];
		for (let i = 0; i < numFiles; i++) {
			const unusedImports = [];
			const importsPerFile = Math.floor(numImports / numFiles) + (i < numImports % numFiles ? 1 : 0);

			for (let j = 0; j < importsPerFile; j++) {
				unusedImports.push({
					line: j + 1,
					importStatement: `import { unused${j} } from 'module${j}';`,
					symbols: [`unused${j}`],
					reason: `Symbol(s) unused${j} not used in code`
				});
			}

			results.push({
				filePath: `test/file${i}.ts`,
				language: 'typescript',
				unusedImports: unusedImports
			});
		}
		return results;
	}

	// Cleanup before each test
	setup(() => {
		if (fs.existsSync(testBaselinePath)) {
			fs.unlinkSync(testBaselinePath);
		}
		baselineManager = new BaselineManager(testBaselinePath);
	});

	// Cleanup after each test
	teardown(() => {
		if (fs.existsSync(testBaselinePath)) {
			fs.unlinkSync(testBaselinePath);
		}
	});

	suite('Baseline Migration (v2.0.0 → v3.0.0)', () => {
		test('Should auto-migrate v2.0.0 baseline to v3.0.0', () => {
			// Create a v2.0.0 baseline file
			const v2Baseline = {
				version: '2.0.0',
				createdAt: '2025-12-19T10:00:00.000Z',
				updatedAt: '2025-12-19T10:00:00.000Z',
				entries: [
					{
						filePath: 'test/example.ts',
						line: 1,
						importStatement: 'import { unused } from "module";',
						symbols: ['unused']
					}
				],
				metadata: {
					totalFiles: 1,
					totalUnusedImports: 1
				}
			};

			fs.writeFileSync(testBaselinePath, JSON.stringify(v2Baseline, null, 2));

			// Load baseline - should trigger migration
			const baseline = baselineManager.loadBaseline();

			assert.ok(baseline, 'Baseline should be loaded');
			assert.strictEqual(baseline!.version, '3.0.0', 'Version should be upgraded to 3.0.0');
			assert.ok(Array.isArray(baseline!.history), 'History array should be initialized');
			assert.strictEqual(baseline!.history!.length, 0, 'History should be empty after migration');
			assert.strictEqual(baseline!.entries.length, 1, 'Existing entries should be preserved');
		});

		test('Should not re-migrate already migrated v3.0.0 baseline', () => {
			// Create a baseline and update it
			const results = createMockResults(2, 2);
			baselineManager.updateBaseline(results);

			// Load it again
			const baseline1 = baselineManager.loadBaseline();
			const baseline2 = baselineManager.loadBaseline();

			assert.strictEqual(baseline1!.version, '3.0.0');
			assert.strictEqual(baseline2!.version, '3.0.0');
			assert.strictEqual(baseline1!.history!.length, baseline2!.history!.length);
		});

		test('Should preserve createdAt timestamp during migration', () => {
			const originalCreatedAt = '2025-12-19T10:00:00.000Z';
			const v2Baseline = {
				version: '2.0.0',
				createdAt: originalCreatedAt,
				updatedAt: '2025-12-19T11:00:00.000Z',
				entries: [],
				metadata: { totalFiles: 0, totalUnusedImports: 0 }
			};

			fs.writeFileSync(testBaselinePath, JSON.stringify(v2Baseline));
			const baseline = baselineManager.loadBaseline();

			assert.strictEqual(baseline!.createdAt, originalCreatedAt, 'createdAt should be preserved');
		});
	});

	suite('Snapshot Capture', () => {
		test('Should capture snapshot on first update after migration', () => {
			// Create v2.0.0 baseline
			const v2Baseline = {
				version: '2.0.0',
				createdAt: '2025-12-19T10:00:00.000Z',
				updatedAt: '2025-12-19T10:00:00.000Z',
				entries: [],
				metadata: { totalFiles: 1, totalUnusedImports: 1 }
			};
			fs.writeFileSync(testBaselinePath, JSON.stringify(v2Baseline));

			// Update baseline - should capture snapshot
			const results = createMockResults(2, 3);
			baselineManager.updateBaseline(results);

			const baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline!.history!.length, 1, 'Should have 1 snapshot');

			const snapshot = baseline!.history![0];
			assert.ok(snapshot.timestamp, 'Snapshot should have timestamp');
			assert.strictEqual(snapshot.metadata.totalFiles, 1, 'Snapshot should capture old state');
			assert.strictEqual(snapshot.metadata.totalUnusedImports, 1, 'Snapshot should capture old state');
		});

		test('Should capture snapshot BEFORE updating entries', () => {
			const results1 = createMockResults(2, 5);
			baselineManager.updateBaseline(results1);

			const results2 = createMockResults(3, 8);
			baselineManager.updateBaseline(results2);

			const baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline!.history!.length, 1, 'Should have 1 snapshot');

			// Snapshot should have the BEFORE state (5 imports), current should have 8
			const snapshot = baseline!.history![0];
			assert.strictEqual(snapshot.metadata.totalUnusedImports, 5, 'Snapshot should have before state');
			assert.strictEqual(baseline!.metadata.totalUnusedImports, 8, 'Current state should be updated');
		});

		test('Should include ISO 8601 timestamp in snapshots', () => {
			const results = createMockResults(1, 1);
			baselineManager.updateBaseline(results);

			const results2 = createMockResults(2, 2);
			baselineManager.updateBaseline(results2);

			const baseline = baselineManager.loadBaseline();
			const snapshot = baseline!.history![0];

			// Verify ISO 8601 format
			assert.ok(snapshot.timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
				'Timestamp should be in ISO 8601 format');

			// Verify it's a valid date
			const date = new Date(snapshot.timestamp);
			assert.ok(!isNaN(date.getTime()), 'Timestamp should be parseable as date');
		});

		test('Should include snapshot version in each snapshot', () => {
			const results = createMockResults(1, 1);
			baselineManager.updateBaseline(results);

			const results2 = createMockResults(2, 2);
			baselineManager.updateBaseline(results2);

			const baseline = baselineManager.loadBaseline();
			const snapshot = baseline!.history![0];

			assert.strictEqual(snapshot.version, '1.0.0', 'Snapshot should have version 1.0.0');
		});

		test('Should handle multiple consecutive updates', () => {
			for (let i = 1; i <= 5; i++) {
				const results = createMockResults(i, i);
				baselineManager.updateBaseline(results);
			}

			const baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline!.history!.length, 4, 'Should have 4 snapshots (5 updates - 1)');
			assert.strictEqual(baseline!.metadata.totalUnusedImports, 5, 'Current state should be latest');
		});
	});

	suite('History Pruning', () => {
		test('Should maintain exactly 30 snapshots when limit exceeded', () => {
			// Create initial baseline
			let results = createMockResults(1, 1);
			baselineManager.updateBaseline(results);

			// Perform 35 updates (should result in 30 snapshots)
			for (let i = 2; i <= 36; i++) {
				results = createMockResults(i, i);
				baselineManager.updateBaseline(results);
			}

			const baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline!.history!.length, 30, 'Should have exactly 30 snapshots');
		});

		test('Should remove oldest snapshots first', () => {
			// Create baseline with identifiable data
			for (let i = 1; i <= 35; i++) {
				const results = createMockResults(i, i);
				baselineManager.updateBaseline(results);
			}

			const baseline = baselineManager.loadBaseline();
			const oldestSnapshot = baseline!.history![0];
			const newestSnapshot = baseline!.history![29];

			// Oldest snapshot should be from update #6 (1-5 were pruned)
			assert.strictEqual(oldestSnapshot.metadata.totalUnusedImports, 5,
				'Oldest snapshot should be from 5th update');

			// Newest snapshot should be from update #34
			assert.strictEqual(newestSnapshot.metadata.totalUnusedImports, 34,
				'Newest snapshot should be from 34th update');
		});

		test('Should maintain chronological order after pruning', () => {
			for (let i = 1; i <= 35; i++) {
				const results = createMockResults(i, i);
				baselineManager.updateBaseline(results);
			}

			const baseline = baselineManager.loadBaseline();
			const timestamps = baseline!.history!.map(s => new Date(s.timestamp).getTime());

			// Verify chronological order (each timestamp should be >= previous)
			for (let i = 1; i < timestamps.length; i++) {
				assert.ok(timestamps[i] >= timestamps[i - 1],
					`Timestamp at index ${i} should be >= previous timestamp`);
			}
		});

		test('Should not prune when history is below limit', () => {
			for (let i = 1; i <= 20; i++) {
				const results = createMockResults(i, i);
				baselineManager.updateBaseline(results);
			}

			const baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline!.history!.length, 19,
				'Should have 19 snapshots (20 updates - 1 for initial)');
		});

		test('Should continue pruning on subsequent updates', () => {
			// Reach limit
			for (let i = 1; i <= 31; i++) {
				baselineManager.updateBaseline(createMockResults(i, i));
			}

			let baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline!.history!.length, 30);

			// Add 5 more updates
			for (let i = 32; i <= 36; i++) {
				baselineManager.updateBaseline(createMockResults(i, i));
			}

			baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline!.history!.length, 30, 'Should still have exactly 30 snapshots');
		});
	});

	suite('Baseline Comparison', () => {
		test('Should identify new issues vs baseline issues', () => {
			// Create baseline with 3 issues
			const baselineResults = createMockResults(3, 3);
			baselineManager.updateBaseline(baselineResults);
			const baseline = baselineManager.loadBaseline()!;

			// Create current results with 5 issues (3 old + 2 new)
			const currentResults = createMockResults(5, 5);

			const comparison = baselineManager.compareWithBaseline(currentResults, baseline);

			assert.strictEqual(comparison.summary.totalBaseline, 3, 'Should have 3 baseline issues');
			assert.strictEqual(comparison.summary.totalNew, 2, 'Should have 2 new issues');
		});

		test('Should handle no new issues', () => {
			const results = createMockResults(3, 3);
			baselineManager.updateBaseline(results);
			const baseline = baselineManager.loadBaseline()!;

			// Same results as baseline
			const comparison = baselineManager.compareWithBaseline(results, baseline);

			assert.strictEqual(comparison.summary.totalNew, 0, 'Should have no new issues');
			assert.strictEqual(comparison.summary.totalBaseline, 3, 'Should have 3 baseline issues');
		});
	});

	suite('Edge Cases', () => {
		test('Should handle baseline file with invalid history field', () => {
			const invalidBaseline = {
				version: '3.0.0',
				createdAt: '2025-12-20T10:00:00.000Z',
				updatedAt: '2025-12-20T10:00:00.000Z',
				entries: [],
				metadata: { totalFiles: 0, totalUnusedImports: 0 },
				history: 'invalid' // Should be array
			};

			fs.writeFileSync(testBaselinePath, JSON.stringify(invalidBaseline));

			const baseline = baselineManager.loadBaseline();
			assert.ok(baseline, 'Baseline should still load');
			assert.ok(Array.isArray(baseline!.history), 'History should be reset to array');
			assert.strictEqual(baseline!.history!.length, 0, 'History should be empty');
		});

		test('Should handle empty baseline file gracefully', () => {
			fs.writeFileSync(testBaselinePath, '{}');

			assert.throws(() => {
				baselineManager.loadBaseline();
			}, /Invalid baseline file format/);
		});

		test('Should handle missing baseline file', () => {
			const baseline = baselineManager.loadBaseline();
			assert.strictEqual(baseline, null, 'Should return null for missing file');
		});

		test('Should handle baseline file with corrupted JSON', () => {
			fs.writeFileSync(testBaselinePath, 'not valid json {{{');

			assert.throws(() => {
				baselineManager.loadBaseline();
			}, /Failed to load baseline/);
		});
	});

	suite('Baseline Generation', () => {
		test('Should generate baseline with correct structure', () => {
			const results = createMockResults(5, 10);
			const baseline = baselineManager.generateBaseline(results);

			assert.strictEqual(baseline.version, '3.0.0');
			assert.ok(baseline.createdAt);
			assert.ok(baseline.updatedAt);
			assert.ok(Array.isArray(baseline.entries));
			assert.strictEqual(baseline.entries.length, 10);
			assert.strictEqual(baseline.metadata.totalFiles, 5);
			assert.strictEqual(baseline.metadata.totalUnusedImports, 10);
		});

		test('Should normalize file paths in baseline', () => {
			const results: AnalysisResult[] = [{
				filePath: 'C:\\Users\\test\\project\\file.ts',
				language: 'typescript',
				unusedImports: [{
					line: 1,
					importStatement: 'import { test } from "module";',
					symbols: ['test'],
					reason: 'Symbol(s) test not used in code'
				}]
			}];

			const baseline = baselineManager.generateBaseline(results);
			const entry = baseline.entries[0];

			// Path should be normalized (forward slashes, relative)
			assert.ok(!entry.filePath.includes('\\'), 'Path should use forward slashes');
		});
	});
});
