/**
 * Team Dashboard Panel
 * Displays workspace-wide team analytics and health metrics
 */

import * as vscode from 'vscode';
import {
  TeamAnalyticsEngine,
  TeamDashboardData,
} from '../analytics/TeamAnalytics';

export class TeamDashboardPanel {
  public static currentPanel: TeamDashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private analytics: TeamAnalyticsEngine;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, analytics: TeamAnalyticsEngine) {
    this.panel = panel;
    this.analytics = analytics;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = this.getWebviewContent(extensionUri);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'refresh':
            this.refresh();
            break;
          case 'exportData':
            this.exportData(message.format);
            break;
          case 'openFile':
            this.openFile(message.filePath);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public static show(extensionUri: vscode.Uri, analytics: TeamAnalyticsEngine) {
    const column = vscode.ViewColumn.Two;

    if (TeamDashboardPanel.currentPanel) {
      TeamDashboardPanel.currentPanel.panel.reveal(column);
      TeamDashboardPanel.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'teamDashboard',
      'ImportLens Team Dashboard',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    TeamDashboardPanel.currentPanel = new TeamDashboardPanel(panel, extensionUri, analytics);
    TeamDashboardPanel.currentPanel.refresh();
  }

  public refresh() {
    const dashboardData = this.analytics.generateDashboard();
    this.panel.webview.postMessage({
      command: 'updateData',
      data: this.serializeDashboardData(dashboardData),
    });
  }

  private serializeDashboardData(data: TeamDashboardData) {
    return {
      healthScore: {
        ...data.healthScore,
        calculatedAt: data.healthScore.calculatedAt.toISOString(),
      },
      languageBreakdown: data.languageBreakdown,
      topImprovedFiles: data.topImprovedFiles.map((f) => ({
        ...f,
        lastAnalyzed: f.lastAnalyzed.toISOString(),
      })),
      topContributors: data.topContributors,
      bottomFiles: data.bottomFiles.map((f) => ({
        ...f,
        lastAnalyzed: f.lastAnalyzed.toISOString(),
      })),
    };
  }

  private async exportData(format: 'json' | 'csv') {
    const dashboardData = this.analytics.generateDashboard();

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`importlens-report-${Date.now()}.${format}`),
      filters: {
        [format.toUpperCase()]: [format],
      },
    });

    if (!saveUri) {
      return;
    }

    let content: string;
    if (format === 'json') {
      content = JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          projectName: vscode.workspace.name || 'Unknown',
          ...this.serializeDashboardData(dashboardData),
        },
        null,
        2
      );
    } else {
      content = this.convertToCSV(dashboardData);
    }

    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(`Report exported to ${saveUri.fsPath}`);
  }

  private convertToCSV(data: TeamDashboardData): string {
    let csv = 'File Path,Language,Total Imports,Unused Imports,Health Score,Trend\n';

    const allFiles = [...data.topImprovedFiles, ...data.bottomFiles];
    for (const file of allFiles) {
      csv += `"${file.filePath}",${file.language},${file.totalImports},${file.unusedImports},${file.healthScore},${file.trend || 'N/A'}\n`;
    }

    return csv;
  }

  private async openFile(filePath: string) {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
    }
  }

  public dispose() {
    TeamDashboardPanel.currentPanel = undefined;
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getWebviewContent(extensionUri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ImportLens Team Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 15px;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 10px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button svg {
      flex-shrink: 0;
    }

    .health-score-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      border-left: 4px solid var(--vscode-button-background);
    }

    .score-large {
      font-size: 48px;
      font-weight: bold;
      margin: 10px 0;
    }

    .score-improving { color: #4caf50; }
    .score-declining { color: #f44336; }
    .score-stable { color: var(--vscode-foreground); }

    .score-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .score-detail {
      display: flex;
      flex-direction: column;
    }

    .score-detail-label {
      font-size: 12px;
      opacity: 0.7;
      margin-bottom: 4px;
    }

    .score-detail-value {
      font-size: 18px;
      font-weight: 600;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }

    .card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 20px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--vscode-foreground);
    }

    .list-item {
      padding: 12px;
      margin-bottom: 8px;
      background-color: var(--vscode-input-background);
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .list-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .list-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .file-path {
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 300px;
    }

    .health-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .health-excellent { background-color: #4caf50; color: white; }
    .health-good { background-color: #8bc34a; color: white; }
    .health-fair { background-color: #ff9800; color: white; }
    .health-poor { background-color: #f44336; color: white; }

    .list-item-details {
      font-size: 12px;
      opacity: 0.8;
      display: flex;
      gap: 16px;
    }

    .list-item-details svg,
    .language-stats svg {
      vertical-align: middle;
      margin-right: 4px;
      opacity: 0.7;
    }

    .language-bar {
      display: flex;
      align-items: center;
      padding: 8px;
      margin-bottom: 8px;
      background-color: var(--vscode-input-background);
      border-radius: 4px;
    }

    .language-name {
      flex: 0 0 100px;
      font-weight: 500;
    }

    .language-stats {
      flex: 1;
      display: flex;
      gap: 16px;
      font-size: 12px;
    }

    .trend-icon {
      font-size: 16px;
      margin-left: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <!-- SVG Icon Definitions -->
  <svg style="display: none;">
    <defs>
      <symbol id="icon-package" viewBox="0 0 16 16">
        <path d="M8 1L3 3.5V8L8 10.5L13 8V3.5L8 1Z" stroke="currentColor" fill="none" stroke-width="1.5"/>
        <path d="M8 5.5V10.5M3 5L8 7.5L13 5" stroke="currentColor" stroke-width="1.5"/>
      </symbol>
      <symbol id="icon-close" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M6 6L10 10M10 6L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </symbol>
      <symbol id="icon-code" viewBox="0 0 16 16">
        <path d="M5 4L2 8L5 12M11 4L14 8L11 12M10 2L6 14" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </symbol>
      <symbol id="icon-folder" viewBox="0 0 16 16">
        <path d="M2 3H6L7 4H14V13H2V3Z" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/>
      </symbol>
      <symbol id="icon-trending-up" viewBox="0 0 16 16">
        <path d="M2 12L6 8L9 11L14 4M14 4H10M14 4V8" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </symbol>
      <symbol id="icon-trending-down" viewBox="0 0 16 16">
        <path d="M2 4L6 8L9 5L14 12M14 12H10M14 12V8" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </symbol>
      <symbol id="icon-trending-stable" viewBox="0 0 16 16">
        <path d="M2 8H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10 5L14 8L10 11" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </symbol>
      <symbol id="icon-alert" viewBox="0 0 16 16">
        <path d="M8 2L2 13H14L8 2Z" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M8 6V9M8 11V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </symbol>
      <symbol id="icon-check" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </symbol>
    </defs>
  </svg>
  <div class="header">
    <h1>Team Dashboard</h1>
    <div class="actions">
      <button onclick="refresh()">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.5 2.5l-8.5 8.5-3-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 1.5c3.6 0 6.5 2.9 6.5 6.5s-2.9 6.5-6.5 6.5-6.5-2.9-6.5-6.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M8 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Refresh
      </button>
      <button onclick="exportData('json')">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3v10h12V3H2zm1 1h10v8H3V4z"/>
          <path d="M5 6h2v4H5V6zm4 0h2v4H9V6z"/>
        </svg>
        Export JSON
      </button>
      <button onclick="exportData('csv')">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 2v12h8V5l-3-3H4zm1 1h3v3h3v7H5V3z"/>
          <path d="M9 3l2 2h-2V3z"/>
        </svg>
        Export CSV
      </button>
    </div>
  </div>

  <div class="health-score-card">
    <div style="opacity: 0.7;">Overall Import Health</div>
    <div class="score-large" id="overallScore">--</div>
    <div id="trend"></div>
    <div class="score-details">
      <div class="score-detail">
        <div class="score-detail-label">Files Analyzed</div>
        <div class="score-detail-value" id="filesAnalyzed">--</div>
      </div>
      <div class="score-detail">
        <div class="score-detail-label">Total Imports</div>
        <div class="score-detail-value" id="totalImports">--</div>
      </div>
      <div class="score-detail">
        <div class="score-detail-label">Unused Imports</div>
        <div class="score-detail-value" id="unusedImports">--</div>
      </div>
      <div class="score-detail">
        <div class="score-detail-label">Change (7d)</div>
        <div class="score-detail-value" id="changeWeek">--</div>
      </div>
    </div>
  </div>

  <div class="dashboard-grid">
    <div class="card">
      <div class="card-title">Top Improved Files</div>
      <div id="topFiles"></div>
    </div>

    <div class="card">
      <div class="card-title">Files Needing Attention</div>
      <div id="bottomFiles"></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Language Breakdown</div>
    <div id="languageBreakdown"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function exportData(format) {
      vscode.postMessage({ command: 'exportData', format });
    }

    function openFile(filePath) {
      vscode.postMessage({ command: 'openFile', filePath });
    }

    function getHealthBadgeClass(score) {
      if (score >= 90) return 'health-excellent';
      if (score >= 70) return 'health-good';
      if (score >= 50) return 'health-fair';
      return 'health-poor';
    }

    function renderFileList(files, containerId) {
      const container = document.getElementById(containerId);

      if (files.length === 0) {
        container.innerHTML = '<div class="empty-state">No data available</div>';
        return;
      }

      container.innerHTML = files.map(file => \`
        <div class="list-item" onclick="openFile('\${file.filePath}')">
          <div class="list-item-header">
            <span class="file-path" title="\${file.filePath}">\${file.filePath.split(/[/\\\\]/).pop()}</span>
            <span class="health-badge \${getHealthBadgeClass(file.healthScore)}">\${file.healthScore}</span>
          </div>
          <div class="list-item-details">
            <span><svg width="14" height="14"><use href="#icon-package"/></svg> \${file.totalImports} imports</span>
            <span><svg width="14" height="14"><use href="#icon-close"/></svg> \${file.unusedImports} unused</span>
            <span><svg width="14" height="14"><use href="#icon-code"/></svg> \${file.language}</span>
            \${file.trend ? \`<span><svg width="14" height="14"><use href="#icon-trending-\${file.trend === 'improving' ? 'up' : file.trend === 'declining' ? 'down' : 'stable'}"/></svg></span>\` : ''}
          </div>
        </div>
      \`).join('');
    }

    function renderLanguageBreakdown(languages) {
      const container = document.getElementById('languageBreakdown');

      if (languages.length === 0) {
        container.innerHTML = '<div class="empty-state">No data available</div>';
        return;
      }

      container.innerHTML = languages.map(lang => \`
        <div class="language-bar">
          <div class="language-name">\${lang.language}</div>
          <div class="language-stats">
            <span><svg width="14" height="14"><use href="#icon-folder"/></svg> \${lang.fileCount} files</span>
            <span><svg width="14" height="14"><use href="#icon-close"/></svg> \${lang.unusedImportCount} unused</span>
            <span class="health-badge \${getHealthBadgeClass(lang.healthScore)}">\${lang.healthScore}</span>
          </div>
        </div>
      \`).join('');
    }

    window.addEventListener('message', event => {
      const message = event.data;

      if (message.command === 'updateData') {
        const data = message.data;

        // Update health score
        const scoreElement = document.getElementById('overallScore');
        scoreElement.textContent = data.healthScore.overallScore;
        scoreElement.className = 'score-large score-' + data.healthScore.trend;

        // Update trend
        const trendLabels = {
          improving: 'Improving',
          declining: 'Declining',
          stable: 'Stable'
        };
        document.getElementById('trend').textContent = trendLabels[data.healthScore.trend] || '';

        // Update details
        document.getElementById('filesAnalyzed').textContent = data.healthScore.filesAnalyzed;
        document.getElementById('totalImports').textContent = data.healthScore.totalImports;
        document.getElementById('unusedImports').textContent = data.healthScore.unusedImports;

        const change = data.healthScore.changeFromLastWeek;
        const changeElement = document.getElementById('changeWeek');
        changeElement.textContent = change > 0 ? '+' + change.toFixed(1) + '%' : change.toFixed(1) + '%';
        changeElement.style.color = change > 0 ? '#4caf50' : change < 0 ? '#f44336' : 'inherit';

        // Render file lists
        renderFileList(data.topImprovedFiles, 'topFiles');
        renderFileList(data.bottomFiles, 'bottomFiles');

        // Render language breakdown
        renderLanguageBreakdown(data.languageBreakdown);
      }
    });

    // Request initial data
    refresh();
  </script>
</body>
</html>`;
  }
}
