import * as vscode from 'vscode';
import { ImportAnalyzer, UnusedImport } from '../core/ImportAnalyzer';
import { LanguageAdapterRegistry } from '../adapters/LanguageAdapter';

/**
 * Provides Quick Fix code actions for unused imports
 */
export class QuickFixProvider implements vscode.CodeActionProvider {
  constructor(
    private analyzer: ImportAnalyzer,
    private adapterRegistry: LanguageAdapterRegistry
  ) {}

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  /**
   * Provide code actions for the given document and range
   */
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[] | undefined> {
    // Only provide actions for diagnostics with Unnecessary tag
    const unusedDiagnostics = context.diagnostics.filter(d =>
      d.tags?.includes(vscode.DiagnosticTag.Unnecessary)
    );

    if (unusedDiagnostics.length === 0) {
      return undefined;
    }

    const actions: vscode.CodeAction[] = [];

    // Get unused imports for this document
    const unusedImports = await this.analyzer.findUnusedImports(document);

    if (unusedImports.length === 0) {
      return undefined;
    }

    // For each diagnostic in range, provide quick fixes
    for (const diagnostic of unusedDiagnostics) {
      // Find the corresponding unused import
      const unusedImport = unusedImports.find(u =>
        u.diagnostic.range.intersection(diagnostic.range)
      );

      if (!unusedImport) {
        continue;
      }

      // Check if this is a partial removal (specific symbols) or full import removal
      if (unusedImport.unusedSymbols.length > 0 && unusedImport.unusedSymbols.length < unusedImport.importInfo.symbols.length) {
        // Partial removal - remove only specific symbols
        actions.push(this.createRemoveSymbolAction(document, unusedImport));
      } else {
        // Full import removal
        actions.push(this.createRemoveImportAction(document, unusedImport));
      }

      // Add "Remove all unused imports" action (only once)
      if (actions.length === 1 && unusedImports.length > 1) {
        actions.push(this.createRemoveAllAction(document, unusedImports));
      }
    }

    return actions;
  }

  /**
   * Create a Quick Fix to remove a specific unused symbol
   */
  private createRemoveSymbolAction(
    document: vscode.TextDocument,
    unusedImport: UnusedImport
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Remove unused symbol${unusedImport.unusedSymbols.length > 1 ? 's' : ''}: ${unusedImport.unusedSymbols.join(', ')}`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [unusedImport.diagnostic];
    action.isPreferred = true;

    const edit = new vscode.WorkspaceEdit();
    const adapter = this.adapterRegistry.getAdapter(document.languageId);

    if (adapter) {
      const lineNumber = unusedImport.importInfo.range.start.line;
      const line = document.lineAt(lineNumber);
      const currentImport = line.text;

      // Remove the unused symbols from the import
      const remainingSymbols = unusedImport.importInfo.symbols.filter(
        s => !unusedImport.unusedSymbols.includes(s)
      );

      // Reconstruct the import statement
      let newImport = '';
      if (remainingSymbols.length > 0) {
        // Keep the import with remaining symbols
        if (unusedImport.importInfo.type === 'named') {
          newImport = `import { ${remainingSymbols.join(', ')} } from '${unusedImport.importInfo.module}';`;
        } else if (unusedImport.importInfo.type === 'default') {
          newImport = `import ${remainingSymbols[0]} from '${unusedImport.importInfo.module}';`;
        } else if (unusedImport.importInfo.type === 'namespace') {
          newImport = `import * as ${remainingSymbols[0]} from '${unusedImport.importInfo.module}';`;
        }
      }

      const lineRange = line.range;
      if (newImport) {
        // Replace with updated import
        edit.replace(document.uri, lineRange, newImport);
      } else {
        // Remove the entire line if no symbols remain
        const fullLineRange = lineRange.with(
          lineRange.start.with(undefined, 0),
          lineRange.end.with(lineRange.end.line + 1, 0)
        );
        edit.delete(document.uri, fullLineRange);
      }
    }

    action.edit = edit;
    return action;
  }

  /**
   * Create a Quick Fix to remove an entire unused import
   */
  private createRemoveImportAction(
    document: vscode.TextDocument,
    unusedImport: UnusedImport
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Remove unused import from '${unusedImport.importInfo.module}'`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [unusedImport.diagnostic];
    action.isPreferred = true;

    const edit = new vscode.WorkspaceEdit();
    const lineNumber = unusedImport.importInfo.range.start.line;
    const line = document.lineAt(lineNumber);

    // Delete the entire line including newline
    const fullLineRange = line.range.with(
      line.range.start.with(undefined, 0),
      line.range.end.with(line.range.end.line + 1, 0)
    );

    edit.delete(document.uri, fullLineRange);
    action.edit = edit;

    return action;
  }

  /**
   * Create a Quick Fix to remove all unused imports in the file
   */
  private createRemoveAllAction(
    document: vscode.TextDocument,
    unusedImports: UnusedImport[]
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Remove all ${unusedImports.length} unused imports`,
      vscode.CodeActionKind.QuickFix
    );

    const edit = new vscode.WorkspaceEdit();

    // Sort unused imports by line number in reverse order (bottom to top)
    // This ensures deleting lines doesn't affect line numbers of previous imports
    const sortedImports = [...unusedImports].sort(
      (a, b) => b.importInfo.range.start.line - a.importInfo.range.start.line
    );

    for (const unusedImport of sortedImports) {
      // Skip side-effect imports in safe mode
      const config = vscode.workspace.getConfiguration('importlens');
      const safeMode = config.get<boolean>('safeMode', true);
      const aggressiveMode = config.get<boolean>('aggressiveMode', false);

      if (safeMode && !aggressiveMode && unusedImport.hasSideEffects) {
        continue;
      }

      const lineNumber = unusedImport.importInfo.range.start.line;
      const line = document.lineAt(lineNumber);
      const fullLineRange = line.range.with(
        line.range.start.with(undefined, 0),
        line.range.end.with(line.range.end.line + 1, 0)
      );

      edit.delete(document.uri, fullLineRange);
    }

    action.edit = edit;
    return action;
  }
}
