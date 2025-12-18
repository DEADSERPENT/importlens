import * as fs from 'fs';
import * as path from 'path';

export interface CLIArguments {
  check: boolean;
  fix: boolean;
  safeMode: boolean;
  aggressive: boolean;
  format: 'text' | 'json' | 'github' | 'junit';
  config?: string;
  exclude: string[];
  files: string[];
  help: boolean;
  version: boolean;
  exitOnError: boolean;
}

export interface ConfigFile {
  safeMode?: boolean;
  aggressiveMode?: boolean;
  excludePatterns?: string[];
  excludedLanguages?: string[];
}

/**
 * Parse command-line arguments
 */
export function parseArgs(argv: string[]): CLIArguments {
  const args: CLIArguments = {
    check: false,
    fix: false,
    safeMode: true,
    aggressive: false,
    format: 'text',
    exclude: [],
    files: [],
    help: false,
    version: false,
    exitOnError: true
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--check') {
      args.check = true;
    } else if (arg === '--fix') {
      args.fix = true;
    } else if (arg === '--safe-mode') {
      args.safeMode = true;
      args.aggressive = false;
    } else if (arg === '--aggressive') {
      args.aggressive = true;
      args.safeMode = false;
    } else if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1] as any;
      if (['text', 'json', 'github', 'junit'].includes(format)) {
        args.format = format;
      } else {
        throw new Error(`Invalid format: ${format}. Must be one of: text, json, github, junit`);
      }
    } else if (arg.startsWith('--config=')) {
      args.config = arg.split('=')[1];
    } else if (arg.startsWith('--exclude=')) {
      args.exclude.push(arg.split('=')[1]);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--version' || arg === '-v') {
      args.version = true;
    } else if (arg === '--no-exit-on-error') {
      args.exitOnError = false;
    } else if (!arg.startsWith('--')) {
      args.files.push(arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  // Default to check mode if neither check nor fix specified
  if (!args.check && !args.fix) {
    args.check = true;
  }

  // Load configuration file if specified or if .importlensrc.json exists
  const configPath = args.config || findConfigFile();
  if (configPath && fs.existsSync(configPath)) {
    mergeConfig(args, loadConfigFile(configPath));
  }

  return args;
}

/**
 * Find configuration file in current directory or parent directories
 */
function findConfigFile(): string | null {
  let currentDir = process.cwd();
  const configNames = ['.importlensrc.json', '.importlensrc'];

  while (currentDir !== path.parse(currentDir).root) {
    for (const configName of configNames) {
      const configPath = path.join(currentDir, configName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Load configuration from file
 */
function loadConfigFile(configPath: string): ConfigFile {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load config file ${configPath}: ${error}`);
  }
}

/**
 * Merge configuration file settings with CLI arguments
 */
function mergeConfig(args: CLIArguments, config: ConfigFile): void {
  // Only apply config if not explicitly set via CLI
  if (config.safeMode !== undefined && !args.aggressive) {
    args.safeMode = config.safeMode;
  }

  if (config.aggressiveMode !== undefined && config.aggressiveMode) {
    args.aggressive = true;
    args.safeMode = false;
  }

  if (config.excludePatterns) {
    args.exclude.push(...config.excludePatterns);
  }

  // Note: excludedLanguages will be handled by the analyzer
}
