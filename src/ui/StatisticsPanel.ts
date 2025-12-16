import * as vscode from 'vscode';
import { ImportAnalyzer } from '../core/ImportAnalyzer';

/**
 * Statistics data structure
 */
export interface StatisticsData {
  total: number;
  safeToRemove: number;
  withSideEffects: number;
  byLanguage: Record<string, number>;
  byConfidence: {
    high: number;
    medium: number;
    low: number;
  };
  filesAnalyzed: number;
  topFiles: Array<{ path: string; count: number }>;
}

/**
 * Manages the statistics dashboard webview panel
 */
export class StatisticsPanel {
  public static currentPanel: StatisticsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, private analyzer: ImportAnalyzer) {
    this.panel = panel;

    // Set the webview's HTML content
    this.update();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'refresh':
            this.update();
            break;
        }
      },
      null,
      this.disposables
    );

    // Cleanup when panel is closed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  /**
   * Create or show the statistics panel
   */
  public static async createOrShow(context: vscode.ExtensionContext, analyzer: ImportAnalyzer) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (StatisticsPanel.currentPanel) {
      StatisticsPanel.currentPanel.panel.reveal(column);
      StatisticsPanel.currentPanel.update();
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'importLensStats',
      'ImportLens Statistics',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    StatisticsPanel.currentPanel = new StatisticsPanel(panel, analyzer);
  }

  /**
   * Collect statistics from workspace
   */
  private async collectStatistics(): Promise<StatisticsData> {
    const documents = vscode.workspace.textDocuments.filter(doc =>
      !doc.isUntitled && doc.uri.scheme === 'file'
    );

    const allUnusedImports: any[] = [];
    const byLanguage: Record<string, number> = {};
    const fileUnusedCounts: Array<{ path: string; count: number }> = [];

    for (const document of documents) {
      const unusedImports = await this.analyzer.findUnusedImports(document);
      allUnusedImports.push(...unusedImports);

      // Track by language
      const lang = document.languageId;
      byLanguage[lang] = (byLanguage[lang] || 0) + unusedImports.length;

      // Track per file
      if (unusedImports.length > 0) {
        fileUnusedCounts.push({
          path: vscode.workspace.asRelativePath(document.uri),
          count: unusedImports.length
        });
      }
    }

    // Sort files by unused import count
    fileUnusedCounts.sort((a, b) => b.count - a.count);
    const topFiles = fileUnusedCounts.slice(0, 10);

    const stats = this.analyzer.getStatistics(allUnusedImports);

    return {
      ...stats,
      byLanguage,
      filesAnalyzed: documents.length,
      topFiles
    };
  }

  /**
   * Update the webview content
   */
  private async update() {
    this.panel.webview.html = this.getLoadingHtml();

    const stats = await this.collectStatistics();
    this.panel.webview.html = this.getHtmlForWebview(stats);
  }

  /**
   * Generate loading HTML
   */
  private getLoadingHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ImportLens Statistics</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="loading">Loading statistics...</div>
    </body>
    </html>`;
  }

  /**
   * Generate the HTML for the webview
   */
  private getHtmlForWebview(stats: StatisticsData): string {
    // Prepare data for charts
    const languageLabels = Object.keys(stats.byLanguage);
    const languageValues = Object.values(stats.byLanguage);

    const confidenceLabels = ['High (>90%)', 'Medium (70-90%)', 'Low (<70%)'];
    const confidenceValues = [
      stats.byConfidence.high,
      stats.byConfidence.medium,
      stats.byConfidence.low
    ];

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ImportLens Statistics</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        h1 {
          color: var(--vscode-foreground);
          margin-bottom: 10px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 1px solid var(--vscode-widget-border);
        }
        .refresh-btn {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          cursor: pointer;
          border-radius: 2px;
        }
        .refresh-btn:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-widget-border);
          border-radius: 4px;
          padding: 20px;
          text-align: center;
        }
        .stat-value {
          font-size: 36px;
          font-weight: bold;
          color: var(--vscode-textLink-foreground);
          margin: 10px 0;
        }
        .stat-label {
          font-size: 14px;
          color: var(--vscode-descriptionForeground);
        }
        .charts-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 30px;
          margin-bottom: 30px;
        }
        .chart-card {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-widget-border);
          border-radius: 4px;
          padding: 20px;
        }
        .chart-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
          color: var(--vscode-foreground);
        }
        .heatmap {
          margin-top: 30px;
        }
        .heatmap-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        .heatmap-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .heatmap-row {
          display: flex;
          align-items: center;
          padding: 12px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-widget-border);
          border-radius: 4px;
        }
        .heatmap-file {
          flex: 1;
          font-family: var(--vscode-editor-font-family);
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .heatmap-bar {
          width: 200px;
          height: 20px;
          background-color: var(--vscode-inputBackground);
          border-radius: 2px;
          margin: 0 15px;
          position: relative;
          overflow: hidden;
        }
        .heatmap-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
          transition: width 0.3s ease;
        }
        .heatmap-count {
          min-width: 40px;
          text-align: right;
          font-weight: 600;
          color: var(--vscode-textLink-foreground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 ImportLens Statistics</h1>
        <button class="refresh-btn" onclick="refresh()">🔄 Refresh</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Unused Imports</div>
          <div class="stat-value">${stats.total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Safe to Remove</div>
          <div class="stat-value">${stats.safeToRemove}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">With Side Effects</div>
          <div class="stat-value">${stats.withSideEffects}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Files Analyzed</div>
          <div class="stat-value">${stats.filesAnalyzed}</div>
        </div>
      </div>

      <div class="charts-container">
        <div class="chart-card">
          <div class="chart-title">Unused Imports by Language</div>
          <canvas id="languageChart"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-title">Confidence Distribution</div>
          <canvas id="confidenceChart"></canvas>
        </div>
      </div>

      <div class="heatmap">
        <div class="heatmap-title">🔥 Top Files with Most Unused Imports</div>
        <div class="heatmap-grid">
          ${stats.topFiles.map((file, index) => {
            const percentage = (file.count / stats.total) * 100;
            return `
            <div class="heatmap-row">
              <div class="heatmap-file" title="${file.path}">${index + 1}. ${file.path}</div>
              <div class="heatmap-bar">
                <div class="heatmap-bar-fill" style="width: ${percentage}%"></div>
              </div>
              <div class="heatmap-count">${file.count}</div>
            </div>
            `;
          }).join('')}
          ${stats.topFiles.length === 0 ? '<div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground);">No unused imports found! 🎉</div>' : ''}
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function refresh() {
          vscode.postMessage({ command: 'refresh' });
        }

        // Language Chart
        const languageCtx = document.getElementById('languageChart').getContext('2d');
        new Chart(languageCtx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(languageLabels)},
            datasets: [{
              label: 'Unused Imports',
              data: ${JSON.stringify(languageValues)},
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            }
          }
        });

        // Confidence Chart
        const confidenceCtx = document.getElementById('confidenceChart').getContext('2d');
        new Chart(confidenceCtx, {
          type: 'doughnut',
          data: {
            labels: ${JSON.stringify(confidenceLabels)},
            datasets: [{
              data: ${JSON.stringify(confidenceValues)},
              backgroundColor: [
                'rgba(40, 167, 69, 0.8)',
                'rgba(255, 193, 7, 0.8)',
                'rgba(220, 53, 69, 0.8)'
              ],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        });
      </script>
    </body>
    </html>`;
  }

  /**
   * Dispose of the panel
   */
  public dispose() {
    StatisticsPanel.currentPanel = undefined;

    // Clean up resources
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
