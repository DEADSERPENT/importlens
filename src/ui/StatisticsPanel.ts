import * as vscode from 'vscode';
import * as path from 'path';
import { ImportAnalyzer } from '../core/ImportAnalyzer';
import type { BaselineFile, HistoricalSnapshot } from '../cli/BaselineManager';

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
  history?: HistoricalSnapshot[];  // Historical data from baseline file
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

    // Load baseline file to get history
    const baseline = await this.loadBaselineFile();

    return {
      ...stats,
      byLanguage,
      filesAnalyzed: documents.length,
      topFiles,
      history: baseline?.history || undefined
    };
  }

  /**
   * Load baseline file from workspace root
   * Returns null if not found or on error (gracefully degrades)
   */
  private async loadBaselineFile(): Promise<BaselineFile | null> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;  // No workspace open
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const baselinePath = path.join(workspaceRoot, '.importlens-baseline.json');

      // Check if file exists
      const fileUri = vscode.Uri.file(baselinePath);
      try {
        const content = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(content).toString('utf-8');
        const baseline = JSON.parse(text) as BaselineFile;

        return baseline;
      } catch {
        return null;  // File doesn't exist or parsing failed
      }
    } catch (error) {
      console.error('Error loading baseline file:', error);
      return null;  // Gracefully degrade
    }
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
        .chart-card-full {
          grid-column: 1 / -1;  /* Span all columns for full width */
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
        <h1>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 8px;">
            <rect x="3" y="3" width="7" height="7" rx="1" fill="#4FC3F7" opacity="0.9"/>
            <rect x="3" y="13" width="7" height="7" rx="1" fill="#66BB6A" opacity="0.9"/>
            <rect x="13" y="3" width="7" height="7" rx="1" fill="#FFA726" opacity="0.9"/>
            <rect x="13" y="13" width="7" height="7" rx="1" fill="#EF5350" opacity="0.9"/>
            <path d="M6 6l2 2M6 16l2 2M16 6l2 2M16 16l2 2" stroke="white" stroke-width="1.5" opacity="0.6"/>
          </svg>
          ImportLens Statistics
        </h1>
        <button class="refresh-btn" onclick="refresh()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 4px;">
            <path d="M4 12a8 8 0 0 1 15.3-3.1M20 12a8 8 0 0 1-15.3 3.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M19 8v4h-4M5 16v-4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style="margin-bottom: 8px;">
            <circle cx="12" cy="12" r="10" stroke="#4FC3F7" stroke-width="2" fill="none"/>
            <path d="M12 6v6l4 2" stroke="#4FC3F7" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="2" fill="#4FC3F7"/>
          </svg>
          <div class="stat-label">Total Unused Imports</div>
          <div class="stat-value">${stats.total}</div>
        </div>
        <div class="stat-card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style="margin-bottom: 8px;">
            <circle cx="12" cy="12" r="10" stroke="#66BB6A" stroke-width="2" fill="none"/>
            <path d="M8 12l2 2 4-4" stroke="#66BB6A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="stat-label">Safe to Remove</div>
          <div class="stat-value">${stats.safeToRemove}</div>
        </div>
        <div class="stat-card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style="margin-bottom: 8px;">
            <path d="M12 2L2 7v10c0 5 10 9 10 9s10-4 10-9V7l-10-5z" stroke="#FFA726" stroke-width="2" fill="none"/>
            <path d="M12 8v4M12 16h.01" stroke="#FFA726" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div class="stat-label">With Side Effects</div>
          <div class="stat-value">${stats.withSideEffects}</div>
        </div>
        <div class="stat-card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style="margin-bottom: 8px;">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#AB47BC" stroke-width="2" fill="none"/>
            <path d="M7 7h10M7 12h10M7 17h7" stroke="#AB47BC" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div class="stat-label">Files Analyzed</div>
          <div class="stat-value">${stats.filesAnalyzed}</div>
        </div>
      </div>

      <div class="charts-container">
        <div class="chart-card">
          <div class="chart-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 6px;">
              <rect x="3" y="14" width="4" height="7" rx="1" fill="#4FC3F7" opacity="0.8"/>
              <rect x="10" y="8" width="4" height="13" rx="1" fill="#66BB6A" opacity="0.8"/>
              <rect x="17" y="3" width="4" height="18" rx="1" fill="#FFA726" opacity="0.8"/>
            </svg>
            Unused Imports by Language
          </div>
          <canvas id="languageChart"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 6px;">
              <circle cx="12" cy="12" r="10" stroke="#AB47BC" stroke-width="2" fill="none"/>
              <path d="M12 12L20 12A8 8 0 0 0 12 4Z" fill="#66BB6A" opacity="0.7"/>
              <path d="M12 12L20 12A8 8 0 0 1 12 20Z" fill="#FFA726" opacity="0.7"/>
            </svg>
            Confidence Distribution
          </div>
          <canvas id="confidenceChart"></canvas>
        </div>
      </div>

      ${stats.history && stats.history.length > 0 ? `
      <div class="charts-container">
        <div class="chart-card chart-card-full">
          <div class="chart-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 6px;">
              <path d="M3 3v18h18" stroke="#4FC3F7" stroke-width="2" stroke-linecap="round"/>
              <path d="M7 15l4-4 3 3 5-8" stroke="#66BB6A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="7" cy="15" r="2" fill="#66BB6A"/>
              <circle cx="11" cy="11" r="2" fill="#66BB6A"/>
              <circle cx="14" cy="14" r="2" fill="#66BB6A"/>
              <circle cx="19" cy="6" r="2" fill="#66BB6A"/>
            </svg>
            Technical Debt Trends (Last ${stats.history.length} Snapshots)
          </div>
          <canvas id="historicalChart"></canvas>
        </div>
      </div>
      ` : stats.history && stats.history.length === 0 ? `
      <div class="charts-container">
        <div class="chart-card chart-card-full">
          <div class="chart-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 6px;">
              <rect x="4" y="14" width="4" height="7" rx="1" fill="#66BB6A" opacity="0.8"/>
              <rect x="10" y="8" width="4" height="13" rx="1" fill="#FFA726" opacity="0.8"/>
              <rect x="16" y="4" width="4" height="17" rx="1" fill="#EF5350" opacity="0.8"/>
            </svg>
            Technical Debt Trends
          </div>
          <div style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style="margin-bottom: 16px;">
              <circle cx="12" cy="12" r="10" stroke="#4FC3F7" stroke-width="2" fill="none"/>
              <path d="M12 6v6l4 2" stroke="#4FC3F7" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No Historical Data Yet</div>
            <div style="font-size: 14px;">Run <code style="background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px;">importlens-cli --baseline-update</code> to start tracking trends over time.</div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="heatmap">
        <div class="heatmap-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 8px;">
            <path d="M12 2C12 2 4 6 4 12C4 16 8 20 12 22C16 20 20 16 20 12C20 6 12 2 12 2Z" fill="url(#fireGradient)" stroke="#FF6B6B" stroke-width="1.5"/>
            <defs>
              <linearGradient id="fireGradient" x1="12" y1="2" x2="12" y2="22">
                <stop offset="0%" stop-color="#FFD700" opacity="0.9"/>
                <stop offset="50%" stop-color="#FF6B6B" opacity="0.8"/>
                <stop offset="100%" stop-color="#EF5350" opacity="0.7"/>
              </linearGradient>
            </defs>
          </svg>
          Top Files with Most Unused Imports
        </div>
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
          ${stats.topFiles.length === 0 ? `
            <div style="text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground);">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style="margin-bottom: 16px;">
                <circle cx="12" cy="12" r="10" stroke="#66BB6A" stroke-width="2" fill="none"/>
                <path d="M8 12l2 2 4-4" stroke="#66BB6A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="1" fill="#66BB6A"/>
                <circle cx="17" cy="7" r="1" fill="#FFD700"/>
                <circle cx="7" cy="7" r="1" fill="#FFD700"/>
                <circle cx="7" cy="17" r="1" fill="#FFD700"/>
              </svg>
              <div style="font-size: 18px; font-weight: 600; color: #66BB6A; margin-bottom: 8px;">All Clean!</div>
              <div style="font-size: 14px;">No unused imports found in your workspace</div>
            </div>
          ` : ''}
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

        // Historical Trends Chart (only if history data exists)
        ${stats.history && stats.history.length > 0 ? `
        const historicalData = ${JSON.stringify(stats.history)};

        // Sort by timestamp (oldest to newest)
        historicalData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Extract data for chart
        const timestamps = historicalData.map(snapshot => {
          const date = new Date(snapshot.timestamp);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        });

        const totalUnusedImports = historicalData.map(snapshot =>
          snapshot.metadata.totalUnusedImports
        );

        const totalFiles = historicalData.map(snapshot =>
          snapshot.metadata.totalFiles
        );

        // Create historical trends chart
        const historicalCtx = document.getElementById('historicalChart').getContext('2d');
        new Chart(historicalCtx, {
          type: 'line',
          data: {
            labels: timestamps,
            datasets: [
              {
                label: 'Unused Imports',
                data: totalUnusedImports,
                borderColor: 'rgba(239, 83, 80, 0.8)',
                backgroundColor: 'rgba(239, 83, 80, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgba(239, 83, 80, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                yAxisID: 'y'
              },
              {
                label: 'Files Analyzed',
                data: totalFiles,
                borderColor: 'rgba(66, 165, 245, 0.8)',
                backgroundColor: 'rgba(66, 165, 245, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgba(66, 165, 245, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
              mode: 'index',
              intersect: false
            },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  usePointStyle: true,
                  padding: 15
                }
              },
              tooltip: {
                callbacks: {
                  title: function(context) {
                    return 'Snapshot: ' + context[0].label;
                  }
                }
              }
            },
            scales: {
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                  display: true,
                  text: 'Unused Imports'
                },
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                  display: true,
                  text: 'Files Analyzed'
                },
                beginAtZero: true,
                grid: {
                  drawOnChartArea: false
                }
              }
            }
          }
        });
        ` : ''}
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
