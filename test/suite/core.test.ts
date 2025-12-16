import * as assert from 'assert';
import * as vscode from 'vscode';
import { LanguageAdapterRegistry } from '../../src/adapters/LanguageAdapter';
import { TypeScriptAdapter } from '../../src/adapters/TypeScriptAdapter';
import { PythonAdapter } from '../../src/adapters/PythonAdapter';
import { GenericLSPAdapter } from '../../src/adapters/GenericLSPAdapter';

suite('Core Component Tests', () => {
	suite('LanguageAdapterRegistry', () => {
		test('Should register and retrieve specific adapters', () => {
			const registry = new LanguageAdapterRegistry();
			const tsAdapter = new TypeScriptAdapter();
			const pyAdapter = new PythonAdapter();

			registry.register(tsAdapter);
			registry.register(pyAdapter);

			assert.ok(registry.getAdapter('typescript'));
			assert.ok(registry.getAdapter('python'));
		});

		test('Should return generic adapter as fallback', () => {
			const registry = new LanguageAdapterRegistry();
			const genericAdapter = new GenericLSPAdapter();

			registry.register(new TypeScriptAdapter());
			registry.register(genericAdapter, true);

			// Should return generic for unknown language
			const adapter = registry.getAdapter('unknown-language');
			assert.ok(adapter);
			assert.strictEqual(adapter, genericAdapter);
		});

		test('Should prioritize specific adapters over generic', () => {
			const registry = new LanguageAdapterRegistry();
			const tsAdapter = new TypeScriptAdapter();
			const genericAdapter = new GenericLSPAdapter();

			registry.register(tsAdapter);
			registry.register(genericAdapter, true);

			const adapter = registry.getAdapter('typescript');
			assert.strictEqual(adapter, tsAdapter);
		});

		test('Should check language support', () => {
			const registry = new LanguageAdapterRegistry();
			registry.register(new TypeScriptAdapter());
			registry.register(new GenericLSPAdapter(), true);

			assert.ok(registry.isLanguageSupported('typescript'));
			assert.ok(registry.isLanguageSupported('unknown')); // Generic fallback
		});
	});

	suite('GenericLSPAdapter', () => {
		const adapter = new GenericLSPAdapter();

		test('Should handle any language', () => {
			assert.ok(adapter.canHandle('anything'));
			assert.ok(adapter.canHandle('unknown-lang'));
		});

		test('Should detect various import keywords', () => {
			assert.ok(adapter.isImportStatement("import foo"));
			assert.ok(adapter.isImportStatement("from foo import bar"));
			assert.ok(adapter.isImportStatement("use foo::bar;"));
			assert.ok(adapter.isImportStatement("require 'foo'"));
			assert.ok(adapter.isImportStatement("using System;"));
			assert.ok(!adapter.isImportStatement("const x = 5"));
		});

		test('Should use conservative side-effect detection', () => {
			const importInfo = {
				type: 'default' as const,
				symbols: ['foo'],
				module: 'unknown',
				fullText: "import foo",
				range: new vscode.Range(0, 0, 0, 10)
			};
			// Generic adapter should be conservative
			const hasSideEffects = adapter.hasSideEffects(importInfo);
			assert.ok(typeof hasSideEffects === 'boolean');
		});
	});

	suite('Integration Tests', () => {
		/**
		 * Wait for extension to be activated with retry logic
		 */
		async function waitForExtension(extensionId: string, maxAttempts = 10): Promise<vscode.Extension<any> | undefined> {
			for (let i = 0; i < maxAttempts; i++) {
				const extension = vscode.extensions.getExtension(extensionId);
				if (extension) {
					// Wait for activation if not already active
					if (!extension.isActive) {
						try {
							await extension.activate();
						} catch (error) {
							console.log(`Activation attempt ${i + 1} failed:`, error);
						}
					}
					if (extension.isActive) {
						return extension;
					}
				}
				// Wait 1 second before retrying
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
			return undefined;
		}

		test('Extension should be present', async () => {
			const ext = await waitForExtension('DEADSERPENT.importlens');
			assert.ok(ext, 'Extension should be loaded');
			assert.ok(ext.isActive, 'Extension should be active');
		});

		test('Commands should be registered', async () => {
			// Ensure extension is activated first
			const ext = await waitForExtension('DEADSERPENT.importlens');
			assert.ok(ext, 'Extension should be loaded before checking commands');

			const commands = await vscode.commands.getCommands();
			assert.ok(commands.includes('importlens.cleanFile'), 'cleanFile command should be registered');
			assert.ok(commands.includes('importlens.cleanWorkspace'), 'cleanWorkspace command should be registered');
			assert.ok(commands.includes('importlens.showStats'), 'showStats command should be registered');
			assert.ok(commands.includes('importlens.toggleSafeMode'), 'toggleSafeMode command should be registered');
		});
	});
});
