import * as assert from 'assert';
import * as vscode from 'vscode';

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

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('Extension should be present', async () => {
		const extension = await waitForExtension('DEADSERPENT.importlens');
		assert.ok(extension, 'Extension should be loaded');
		assert.ok(extension.isActive, 'Extension should be active');
	});
});
