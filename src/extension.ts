import * as vscode from 'vscode';
import { LanguageAdapterRegistry } from './adapters/LanguageAdapter';
import { TypeScriptAdapter } from './adapters/TypeScriptAdapter';
import { PythonAdapter } from './adapters/PythonAdapter';
import { JavaAdapter } from './adapters/JavaAdapter';
import { GoAdapter } from './adapters/GoAdapter';
import { RustAdapter } from './adapters/RustAdapter';
import { CppAdapter } from './adapters/CppAdapter';
import { GenericLSPAdapter } from './adapters/GenericLSPAdapter';
import { ImportAnalyzer } from './core/ImportAnalyzer';
import { SafeEditExecutor } from './core/SafeEditExecutor';
import { DiagnosticListener } from './core/DiagnosticListener';
import { StatisticsPanel } from './ui/StatisticsPanel';

let diagnosticListener: DiagnosticListener | null = null;
let analyzer: ImportAnalyzer | null = null;
let executor: SafeEditExecutor | null = null;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('ImportLens is now active');

  // Initialize adapter registry
  const adapterRegistry = new LanguageAdapterRegistry();
  adapterRegistry.register(new TypeScriptAdapter());
  adapterRegistry.register(new PythonAdapter());
  adapterRegistry.register(new JavaAdapter());
  adapterRegistry.register(new GoAdapter());
  adapterRegistry.register(new RustAdapter());
  adapterRegistry.register(new CppAdapter());
  adapterRegistry.register(new GenericLSPAdapter(), true); // Generic fallback

  // Initialize core components
  analyzer = new ImportAnalyzer(adapterRegistry);
  executor = new SafeEditExecutor(adapterRegistry);
  diagnosticListener = new DiagnosticListener(analyzer);

  // Register commands
  registerCommands(context);

  // Register save listener if enabled
  registerSaveListener(context);

  vscode.window.showInformationMessage('ImportLens activated! 🔍');
}

/**
 * Extension deactivation
 */
export function deactivate() {
  if (diagnosticListener) {
    diagnosticListener.dispose();
  }
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext) {
  // Command: Clean Current File
  const cleanCurrentFileCommand = vscode.commands.registerCommand(
    'importlens.cleanFile',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      if (!analyzer || !executor) {
        return;
      }

      const config = vscode.workspace.getConfiguration('importlens');
      const aggressiveMode = config.get<boolean>('aggressiveMode', false);
      const safeMode = aggressiveMode ? false : config.get<boolean>('safeMode', true);
      const showDiff = config.get<boolean>('showDiffBeforeApply', true);

      // Find unused imports
      const unusedImports = await analyzer.findUnusedImports(editor.document);

      if (unusedImports.length === 0) {
        vscode.window.showInformationMessage('No unused imports found! ✓');
        return;
      }

      // Execute removal
      await executor.execute(unusedImports, {
        safeMode,
        showDiff,
        requireConfirmation: true
      });
    }
  );

  // Command: Clean Workspace
  const cleanWorkspaceCommand = vscode.commands.registerCommand(
    'importlens.cleanWorkspace',
    async () => {
      if (!analyzer || !executor) {
        return;
      }

      const config = vscode.workspace.getConfiguration('importlens');
      const aggressiveMode = config.get<boolean>('aggressiveMode', false);
      const safeMode = aggressiveMode ? false : config.get<boolean>('safeMode', true);

      // Get all text documents in workspace
      const documents = vscode.workspace.textDocuments.filter(doc =>
        !doc.isUntitled && doc.uri.scheme === 'file'
      );

      if (documents.length === 0) {
        vscode.window.showWarningMessage('No documents found in workspace');
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Cleaning unused imports in workspace',
          cancellable: true
        },
        async (progress, token) => {
          let totalRemoved = 0;
          let filesProcessed = 0;

          for (let i = 0; i < documents.length; i++) {
            // Check for cancellation
            if (token.isCancellationRequested) {
              vscode.window.showWarningMessage(
                `Operation cancelled. Processed ${filesProcessed} of ${documents.length} files.`
              );
              return;
            }

            const document = documents[i];

            progress.report({
              message: `Processing ${vscode.workspace.asRelativePath(document.uri)} (${i + 1}/${documents.length})`,
              increment: (100 / documents.length)
            });

            const unusedImports = await analyzer!.findUnusedImports(document);

            if (unusedImports.length > 0) {
              const result = await executor!.executeForDocument(
                document,
                unusedImports,
                safeMode
              );

              if (result.applied) {
                totalRemoved += result.count;
                filesProcessed++;
              }
            }
          }

          vscode.window.showInformationMessage(
            `Workspace cleanup complete! Removed ${totalRemoved} import(s) from ${filesProcessed} file(s).`
          );
        }
      );
    }
  );

  // Command: Show Statistics
  const showStatisticsCommand = vscode.commands.registerCommand(
    'importlens.showStats',
    async () => {
      if (!analyzer) {
        return;
      }

      // Show the enhanced statistics panel with charts and visualizations
      StatisticsPanel.createOrShow(context, analyzer);
    }
  );

  // Command: Toggle Safe Mode
  const toggleSafeModeCommand = vscode.commands.registerCommand(
    'importlens.toggleSafeMode',
    async () => {
      const config = vscode.workspace.getConfiguration('importlens');
      const currentValue = config.get<boolean>('safeMode', true);
      await config.update('safeMode', !currentValue, vscode.ConfigurationTarget.Global);

      const newValue = !currentValue;
      const message = newValue
        ? 'Safe Mode enabled ✓ (Side-effect imports will be preserved)'
        : 'Safe Mode disabled ⚠️ (All unused imports will be removed)';

      vscode.window.showInformationMessage(message);
    }
  );

  // Register all commands
  context.subscriptions.push(
    cleanCurrentFileCommand,
    cleanWorkspaceCommand,
    showStatisticsCommand,
    toggleSafeModeCommand
  );
}

/**
 * Register save listener for auto-cleaning on save
 */
function registerSaveListener(context: vscode.ExtensionContext) {
  const saveListener = vscode.workspace.onWillSaveTextDocument(async (event) => {
    if (!analyzer || !executor) {
      return;
    }

    const config = vscode.workspace.getConfiguration('importlens');
    const enableOnSave = config.get<boolean>('enableOnSave', false);

    if (!enableOnSave) {
      return;
    }

    const aggressiveMode = config.get<boolean>('aggressiveMode', false);
    const safeMode = aggressiveMode ? false : config.get<boolean>('safeMode', true);

    // Find unused imports
    const unusedImports = await analyzer.findUnusedImports(event.document);

    if (unusedImports.length === 0) {
      return;
    }

    // Execute removal (without confirmation or diff)
    await executor.executeForDocument(event.document, unusedImports, safeMode);
  });

  context.subscriptions.push(saveListener);
}
