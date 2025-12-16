import * as vscode from 'vscode';
import type { UnusedImport } from './ImportAnalyzer';

/**
 * Options for executing import removal
 */
export interface ExecutionOptions {
  /** If true, skip imports with side effects */
  safeMode: boolean;
  /** If true, show diff preview before applying */
  showDiff: boolean;
  /** If true, show confirmation dialog */
  requireConfirmation: boolean;
}

/**
 * Result of executing import removal
 */
export interface ExecutionResult {
  /** Whether the edit was applied */
  applied: boolean;
  /** Number of imports removed */
  count: number;
  /** Number of lines removed */
  linesRemoved: number;
  /** Reason if not applied */
  reason?: string;
}

/**
 * Safely executes removal of unused imports
 */
export class SafeEditExecutor {
  /**
   * Remove unused imports from documents
   * @param unusedImports Array of unused imports to remove
   * @param options Execution options
   * @returns Execution result
   */
  async execute(
    unusedImports: UnusedImport[],
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    try {
      if (unusedImports.length === 0) {
        return {
          applied: false,
          count: 0,
          linesRemoved: 0,
          reason: 'No unused imports found'
        };
      }

    // Filter based on safe mode
    let importsToRemove = unusedImports;
    if (options.safeMode) {
      importsToRemove = unusedImports.filter(u => !u.hasSideEffects);

      if (importsToRemove.length === 0) {
        const msg = `Found ${unusedImports.length} unused import(s), but all have potential side effects. ` +
                    `Enable Aggressive Mode to remove them anyway.`;
        vscode.window.showInformationMessage(msg);
        return {
          applied: false,
          count: 0,
          linesRemoved: 0,
          reason: 'All imports have side effects'
        };
      }
    }

    // Sort by URI and line number (descending) to avoid offset issues
    importsToRemove.sort((a, b) => {
      const uriCompare = a.uri.toString().localeCompare(b.uri.toString());
      if (uriCompare !== 0) return uriCompare;
      return b.importInfo.range.start.line - a.importInfo.range.start.line;
    });

    // Show confirmation if required
    if (options.requireConfirmation) {
      const confirmed = await this.showConfirmation(importsToRemove);
      if (!confirmed) {
        return {
          applied: false,
          count: 0,
          linesRemoved: 0,
          reason: 'User cancelled'
        };
      }
    }

    // Create workspace edit
    const edit = new vscode.WorkspaceEdit();

    for (const unusedImport of importsToRemove) {
      const document = await vscode.workspace.openTextDocument(unusedImport.uri);
      const line = unusedImport.importInfo.range.start.line;

      // Delete the entire line including newline
      const lineRange = document.lineAt(line).rangeIncludingLineBreak;

      edit.delete(unusedImport.uri, lineRange);
    }

    // Show diff if requested
    if (options.showDiff && importsToRemove.length > 0) {
      const userApproved = await this.showDiffPreview(importsToRemove[0].uri, edit);
      if (!userApproved) {
        return {
          applied: false,
          count: 0,
          linesRemoved: 0,
          reason: 'User rejected changes after diff preview'
        };
      }
    }

    // Apply the edit
    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      const message = options.safeMode && unusedImports.length > importsToRemove.length
        ? `Removed ${importsToRemove.length} unused import(s). ` +
          `Skipped ${unusedImports.length - importsToRemove.length} with side effects.`
        : `Removed ${importsToRemove.length} unused import(s).`;

      vscode.window.showInformationMessage(message);
    }

      return {
        applied: success,
        count: importsToRemove.length,
        linesRemoved: importsToRemove.length,
        reason: success ? undefined : 'Failed to apply workspace edit'
      };
    } catch (error) {
      console.error('Error executing import removal:', error);
      vscode.window.showErrorMessage(`ImportLens: Failed to remove imports - ${error}`);
      return {
        applied: false,
        count: 0,
        linesRemoved: 0,
        reason: `Error: ${error}`
      };
    }
  }

  /**
   * Show confirmation dialog
   * @param unusedImports Imports to be removed
   * @returns true if user confirmed
   */
  private async showConfirmation(unusedImports: UnusedImport[]): Promise<boolean> {
    const message = `Remove ${unusedImports.length} unused import(s)?`;
    const choice = await vscode.window.showQuickPick(
      ['Yes', 'No', 'Show Details'],
      { placeHolder: message }
    );

    if (choice === 'Show Details') {
      // Show details in output channel
      const output = vscode.window.createOutputChannel('ImportLens');
      output.clear();
      output.appendLine('Unused Imports to be Removed:');
      output.appendLine('━'.repeat(50));

      for (const unusedImport of unusedImports) {
        output.appendLine(`\nFile: ${unusedImport.uri.fsPath}`);
        output.appendLine(`Line ${unusedImport.importInfo.range.start.line + 1}: ${unusedImport.importInfo.fullText}`);
        output.appendLine(`Reason: ${unusedImport.explanation.split('\n')[2]}`);
      }

      output.show();

      // Ask again
      const finalChoice = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        { placeHolder: 'Remove these imports?' }
      );

      return finalChoice === 'Yes';
    }

    return choice === 'Yes';
  }

  /**
   * Show diff preview before applying changes
   * @param uri Document URI
   * @param edit The workspace edit
   * @returns true if user approved
   */
  private async showDiffPreview(uri: vscode.Uri, edit: vscode.WorkspaceEdit): Promise<boolean> {
    try {
      // Get the original document
      const originalDocument = await vscode.workspace.openTextDocument(uri);
      const originalContent = originalDocument.getText();

      // Apply edits to get modified content
      let modifiedContent = originalContent;
      const edits = edit.get(uri);

      if (edits && edits.length > 0) {
        // Sort edits by position (descending) to avoid offset issues
        const sortedEdits = [...edits].sort((a, b) =>
          b.range.start.compareTo(a.range.start)
        );

        // Apply each edit
        for (const textEdit of sortedEdits) {
          const startOffset = originalDocument.offsetAt(textEdit.range.start);
          const endOffset = originalDocument.offsetAt(textEdit.range.end);
          modifiedContent =
            modifiedContent.substring(0, startOffset) +
            textEdit.newText +
            modifiedContent.substring(endOffset);
        }
      }

      // Create temporary URIs for diff view
      const originalUri = uri.with({
        scheme: 'vscode-original',
        path: uri.path + '.original'
      });
      const modifiedUri = uri.with({
        scheme: 'vscode-modified',
        path: uri.path + '.modified'
      });

      // Register text document content provider
      const contentProvider = new (class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri): string {
          if (uri.scheme === 'vscode-original') {
            return originalContent;
          } else {
            return modifiedContent;
          }
        }
      })();

      const providerDisposable = vscode.workspace.registerTextDocumentContentProvider(
        'vscode-original',
        contentProvider
      );
      const modifiedProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
        'vscode-modified',
        contentProvider
      );

      // Show diff
      const fileName = vscode.workspace.asRelativePath(uri);
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        `${fileName} ← Smart Import Cleaner`
      );

      // Ask user to confirm
      const choice = await vscode.window.showQuickPick(
        ['Apply Changes', 'Cancel'],
        {
          placeHolder: 'Review the diff and choose an action'
        }
      );

      // Cleanup
      providerDisposable.dispose();
      modifiedProviderDisposable.dispose();

      return choice === 'Apply Changes';
    } catch (error) {
      console.error('Error showing diff preview:', error);
      // Fallback to simple confirmation
      const choice = await vscode.window.showQuickPick(
        ['Apply Changes', 'Cancel'],
        {
          placeHolder: `Preview changes to ${vscode.workspace.asRelativePath(uri)}?`
        }
      );
      return choice === 'Apply Changes';
    }
  }

  /**
   * Remove unused imports from a single document immediately
   * Convenience method for single-file operations
   * @param document The document
   * @param unusedImports Unused imports in this document
   * @param safeMode Whether to use safe mode
   */
  async executeForDocument(
    document: vscode.TextDocument,
    unusedImports: UnusedImport[],
    safeMode: boolean = true
  ): Promise<ExecutionResult> {
    return this.execute(unusedImports, {
      safeMode,
      showDiff: false,
      requireConfirmation: false
    });
  }
}
