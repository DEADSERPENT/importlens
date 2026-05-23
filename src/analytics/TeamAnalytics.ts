/**
 * Team Analytics Module
 * Provides workspace-wide insights and team health metrics for ImportLens
 */

import { execSync } from 'child_process';

export interface FileHealthMetric {
  filePath: string;
  language: string;
  totalImports: number;
  unusedImports: number;
  healthScore: number; // 0-100
  lastAnalyzed: Date;
  trend?: 'improving' | 'declining' | 'stable';
}

export interface DeveloperMetric {
  author: string;
  filesOwned: number;
  totalUnusedImports: number;
  averageHealthScore: number;
  mostImprovedFiles: string[];
  contribution: 'high' | 'medium' | 'low';
}

export interface TeamHealthScore {
  overallScore: number; // 0-100
  totalFiles: number;
  filesAnalyzed: number;
  totalImports: number;
  unusedImports: number;
  changeFromLastWeek: number; // percentage change
  trend: 'improving' | 'declining' | 'stable';
  calculatedAt: Date;
}

export interface LanguageBreakdown {
  language: string;
  fileCount: number;
  unusedImportCount: number;
  healthScore: number;
}

export interface TeamDashboardData {
  healthScore: TeamHealthScore;
  languageBreakdown: LanguageBreakdown[];
  topImprovedFiles: FileHealthMetric[];
  topContributors: DeveloperMetric[];
  bottomFiles: FileHealthMetric[]; // Files needing attention
}

export interface ComparisonMetric {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercentage: number;
}

export interface AnalyticsExportData {
  generatedAt: Date;
  projectName: string;
  teamDashboard: TeamDashboardData;
  fileMetrics: FileHealthMetric[];
  comparisonMetrics: ComparisonMetric[];
}

/**
 * Calculate health score for a file based on import usage
 */
export class HealthScoreCalculator {
  /**
   * Calculate health score (0-100) for a file
   * Formula: 100 - (unusedImports / totalImports * 100)
   * Bonus points for zero unused imports
   */
  static calculateFileScore(totalImports: number, unusedImports: number): number {
    if (totalImports === 0) {
      return 100; // No imports = perfect score
    }

    const baseScore = ((totalImports - unusedImports) / totalImports) * 100;

    // Bonus points for zero unused imports
    if (unusedImports === 0) {
      return 100;
    }

    return Math.round(baseScore);
  }

  /**
   * Calculate overall team health score
   * Weighted average across all analyzed files
   */
  static calculateTeamScore(fileMetrics: FileHealthMetric[]): number {
    if (fileMetrics.length === 0) {
      return 100;
    }

    const totalScore = fileMetrics.reduce((sum, file) => sum + file.healthScore, 0);
    return Math.round(totalScore / fileMetrics.length);
  }

  /**
   * Determine trend based on historical data
   */
  static determineTrend(current: number, previous: number): 'improving' | 'declining' | 'stable' {
    const threshold = 2; // 2% threshold for "stable"
    const change = ((current - previous) / previous) * 100;

    if (Math.abs(change) < threshold) {
      return 'stable';
    }

    return change > 0 ? 'improving' : 'declining';
  }

  /**
   * Calculate percentage change
   */
  static calculateChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    return ((current - previous) / previous) * 100;
  }
}

/**
 * Git integration for resolving file authorship via git log.
 * All operations are best-effort and silent on failure.
 */
class GitIntegration {
  static isGitRepo(workspaceRoot: string): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: workspaceRoot,
        stdio: 'pipe',
        timeout: 3000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns a map of author name → commit count for the given file.
   * Uses git log for speed; a commit-weighted count approximates ownership.
   */
  static getFileAuthorCounts(filePath: string, workspaceRoot: string): Map<string, number> {
    const counts = new Map<string, number>();
    try {
      const output = execSync(
        `git log --follow --format="%an" -- "${filePath}"`,
        { cwd: workspaceRoot, encoding: 'utf-8', stdio: 'pipe', timeout: 5000 }
      );
      for (const line of output.trim().split('\n')) {
        const author = line.trim();
        if (author && author !== 'Not Committed Yet') {
          counts.set(author, (counts.get(author) || 0) + 1);
        }
      }
    } catch {
      // git not available or file not tracked
    }
    return counts;
  }

  /** Returns the author with the highest commit count for a file, or null. */
  static getPrimaryAuthor(filePath: string, workspaceRoot: string): string | null {
    const counts = this.getFileAuthorCounts(filePath, workspaceRoot);
    if (counts.size === 0) return null;
    let primary: string | null = null;
    let max = 0;
    for (const [author, count] of counts) {
      if (count > max) { max = count; primary = author; }
    }
    return primary;
  }
}

/**
 * Team Analytics Engine
 * Aggregates and analyzes data across the entire workspace
 */
export class TeamAnalyticsEngine {
  private fileMetrics: Map<string, FileHealthMetric> = new Map();
  private developerMetrics: Map<string, DeveloperMetric> = new Map();

  /**
   * Add or update a file metric
   */
  addFileMetric(metric: FileHealthMetric): void {
    this.fileMetrics.set(metric.filePath, metric);
  }

  /**
   * Get all file metrics
   */
  getAllFileMetrics(): FileHealthMetric[] {
    return Array.from(this.fileMetrics.values());
  }

  /**
   * Calculate language breakdown
   */
  calculateLanguageBreakdown(): LanguageBreakdown[] {
    const languageMap = new Map<string, { fileCount: number; unusedCount: number; scores: number[] }>();

    for (const file of this.fileMetrics.values()) {
      const existing = languageMap.get(file.language) || {
        fileCount: 0,
        unusedCount: 0,
        scores: [],
      };

      existing.fileCount++;
      existing.unusedCount += file.unusedImports;
      existing.scores.push(file.healthScore);

      languageMap.set(file.language, existing);
    }

    return Array.from(languageMap.entries()).map(([language, data]) => ({
      language,
      fileCount: data.fileCount,
      unusedImportCount: data.unusedCount,
      healthScore: Math.round(data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length),
    }));
  }

  /**
   * Get top improved files (based on trend)
   */
  getTopImprovedFiles(limit: number = 5): FileHealthMetric[] {
    return Array.from(this.fileMetrics.values())
      .filter((file) => file.trend === 'improving')
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, limit);
  }

  /**
   * Get files needing attention (lowest health scores)
   */
  getBottomFiles(limit: number = 5): FileHealthMetric[] {
    return Array.from(this.fileMetrics.values())
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, limit);
  }

  /**
   * Calculate team health score
   */
  calculateTeamHealth(previousScore?: number): TeamHealthScore {
    const files = Array.from(this.fileMetrics.values());
    const totalFiles = files.length;
    const totalImports = files.reduce((sum, f) => sum + f.totalImports, 0);
    const unusedImports = files.reduce((sum, f) => sum + f.unusedImports, 0);
    const overallScore = HealthScoreCalculator.calculateTeamScore(files);

    let changeFromLastWeek = 0;
    let trend: 'improving' | 'declining' | 'stable' = 'stable';

    if (previousScore !== undefined) {
      changeFromLastWeek = HealthScoreCalculator.calculateChange(overallScore, previousScore);
      trend = HealthScoreCalculator.determineTrend(overallScore, previousScore);
    }

    return {
      overallScore,
      totalFiles,
      filesAnalyzed: totalFiles,
      totalImports,
      unusedImports,
      changeFromLastWeek,
      trend,
      calculatedAt: new Date(),
    };
  }

  /**
   * Populate developerMetrics by resolving each file's primary author via git log.
   * No-ops silently when the workspace is not a git repository.
   */
  loadGitContributors(workspaceRoot: string): void {
    if (!GitIntegration.isGitRepo(workspaceRoot)) return;

    const authorData = new Map<string, {
      filesOwned: number;
      totalUnusedImports: number;
      totalScore: number;
      improvedFiles: string[];
    }>();

    for (const [filePath, metric] of this.fileMetrics.entries()) {
      const author = GitIntegration.getPrimaryAuthor(filePath, workspaceRoot);
      if (!author) continue;

      const data = authorData.get(author) ?? {
        filesOwned: 0, totalUnusedImports: 0, totalScore: 0, improvedFiles: [],
      };

      data.filesOwned++;
      data.totalUnusedImports += metric.unusedImports;
      data.totalScore += metric.healthScore;
      if (metric.trend === 'improving') {
        data.improvedFiles.push(filePath);
      }

      authorData.set(author, data);
    }

    this.developerMetrics.clear();
    for (const [author, data] of authorData.entries()) {
      const avgScore = data.filesOwned > 0 ? Math.round(data.totalScore / data.filesOwned) : 0;
      const contribution: 'high' | 'medium' | 'low' =
        avgScore >= 80 ? 'high' : avgScore >= 60 ? 'medium' : 'low';

      this.developerMetrics.set(author, {
        author,
        filesOwned: data.filesOwned,
        totalUnusedImports: data.totalUnusedImports,
        averageHealthScore: avgScore,
        mostImprovedFiles: data.improvedFiles.slice(0, 3),
        contribution,
      });
    }
  }

  /**
   * Return top contributors sorted by average health score (best first).
   */
  getTopContributors(limit: number = 5): DeveloperMetric[] {
    return Array.from(this.developerMetrics.values())
      .sort((a, b) => b.averageHealthScore - a.averageHealthScore)
      .slice(0, limit);
  }

  /**
   * Generate complete dashboard data.
   * Pass workspaceRoot to enable git-powered contributor metrics.
   */
  generateDashboard(previousScore?: number, workspaceRoot?: string): TeamDashboardData {
    if (workspaceRoot) {
      this.loadGitContributors(workspaceRoot);
    }
    return {
      healthScore: this.calculateTeamHealth(previousScore),
      languageBreakdown: this.calculateLanguageBreakdown(),
      topImprovedFiles: this.getTopImprovedFiles(5),
      topContributors: this.getTopContributors(5),
      bottomFiles: this.getBottomFiles(5),
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.fileMetrics.clear();
    this.developerMetrics.clear();
  }
}
