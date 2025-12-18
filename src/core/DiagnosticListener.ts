import * as vscode from 'vscode';
import { ImportAnalyzer } from './ImportAnalyzer';

/**
 * Listens to diagnostic changes and identifies unused imports
 */
export class DiagnosticListener {
  private disposable: vscode.Disposable;
  private decorationType: vscode.TextEditorDecorationType;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private cache: Map<string, { imports: any[], timestamp: number }> = new Map();
  private readonly DEBOUNCE_DELAY = 500; // ms
  private readonly CACHE_TTL = 5000; // ms

  constructor(
    private analyzer: ImportAnalyzer,
    private onUpdate?: () => void | Promise<void>
  ) {
    // Create decoration type for dimming unused imports
    this.decorationType = vscode.window.createTextEditorDecorationType({
      opacity: '0.5',
      textDecoration: 'line-through'
    });

    // Listen to diagnostic changes
    this.disposable = vscode.languages.onDidChangeDiagnostics(
      (event: vscode.DiagnosticChangeEvent) => {
        this.handleDiagnosticChange(event);
      }
    );
  }

  /**
   * Handle diagnostic change events
   * @param event The diagnostic change event
   */
  private async handleDiagnosticChange(event: vscode.DiagnosticChangeEvent): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('importlens');
      const showDecorations = config.get<boolean>('showExplanationTooltip', true);

      if (!showDecorations) {
        return;
      }

      // Process each changed URI with debouncing
      for (const uri of event.uris) {
        try {
          // Check if this file is excluded
          if (this.isExcluded(uri)) {
            continue;
          }

          const uriString = uri.toString();

          // Clear existing debounce timer for this URI
          const existingTimer = this.debounceTimers.get(uriString);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          // Set new debounce timer
          const timer = setTimeout(async () => {
            try {
              // Get the document
              const documents = vscode.workspace.textDocuments.filter(
                doc => doc.uri.toString() === uriString
              );

              if (documents.length === 0) {
                return;
              }

              const document = documents[0];

              // Check cache
              const cached = this.cache.get(uriString);
              const now = Date.now();
              if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
                // Use cached result
                this.updateDecorations(document, cached.imports);

                // Trigger status bar update
                if (this.onUpdate) {
                  await this.onUpdate();
                }
                return;
              }

              // Find unused imports
              const unusedImports = await this.analyzer.findUnusedImports(document);

              // Update cache
              this.cache.set(uriString, {
                imports: unusedImports,
                timestamp: now
              });

              // Update decorations
              this.updateDecorations(document, unusedImports);

              // Trigger status bar update
              if (this.onUpdate) {
                await this.onUpdate();
              }
            } catch (error) {
              console.error(`Error processing diagnostic change for ${uri.fsPath}:`, error);
            } finally {
              this.debounceTimers.delete(uriString);
            }
          }, this.DEBOUNCE_DELAY);

          this.debounceTimers.set(uriString, timer);
        } catch (error) {
          console.error(`Error setting up diagnostic processing for ${uri.fsPath}:`, error);
          // Continue with other URIs
        }
      }
    } catch (error) {
      console.error('Error handling diagnostic change event:', error);
      // Don't show error message to user for background operations
    }
  }

  /**
   * Update decorations for unused imports
   * @param document The document
   * @param unusedImports Unused imports to highlight
   */
  private updateDecorations(
    document: vscode.TextDocument,
    unusedImports: any[]
  ): void {
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.toString() === document.uri.toString()
    );

    if (!editor) {
      return;
    }

    const decorations: vscode.DecorationOptions[] = unusedImports.map(u => ({
      range: u.importInfo.range,
      hoverMessage: new vscode.MarkdownString(
        `**Unused Import**\n\n${u.explanation}`
      )
    }));

    editor.setDecorations(this.decorationType, decorations);
  }

  /**
   * Check if a file should be excluded from analysis
   * @param uri File URI
   * @returns true if excluded
   */
  private isExcluded(uri: vscode.Uri): boolean {
    const config = vscode.workspace.getConfiguration('importlens');
    const excludedLanguages = config.get<string[]>('excludedLanguages', []);
    const excludePatterns = config.get<string[]>('excludePatterns', []);

    // Check if file is in workspace
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return true;
    }

    // Get document to check language
    const documents = vscode.workspace.textDocuments.filter(
      doc => doc.uri.toString() === uri.toString()
    );

    if (documents.length > 0) {
      const document = documents[0];
      if (excludedLanguages.includes(document.languageId)) {
        return true;
      }
    }

    // Check exclude patterns
    const relativePath = vscode.workspace.asRelativePath(uri);
    for (const pattern of excludePatterns) {
      if (this.matchGlobPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match a file path against a glob pattern
   * @param path File path to match
   * @param pattern Glob pattern
   * @returns true if matches
   */
  private matchGlobPattern(path: string, pattern: string): boolean {
    // Escape special regex characters except glob wildcards
    const escapeRegex = (str: string) =>
      str.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    // Convert glob pattern to regex
    let regexPattern = escapeRegex(pattern);

    // Replace glob wildcards
    // ** matches any number of directories
    regexPattern = regexPattern.replace(/\\\*\\\*/g, '.*');
    // * matches any characters except /
    regexPattern = regexPattern.replace(/\\\*/g, '[^/]*');
    // ? matches any single character except /
    regexPattern = regexPattern.replace(/\\\?/g, '[^/]');

    // Anchor the pattern
    regexPattern = `^${regexPattern}$`;

    const regex = new RegExp(regexPattern);
    return regex.test(path);
  }

  /**
   * Manually trigger analysis for current editor
   */
  async analyzeCurrentEditor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const unusedImports = await this.analyzer.findUnusedImports(editor.document);
    this.updateDecorations(editor.document, unusedImports);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear cache
    this.cache.clear();

    this.disposable.dispose();
    this.decorationType.dispose();
  }
}
