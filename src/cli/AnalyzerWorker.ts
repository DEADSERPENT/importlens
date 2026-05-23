/**
 * Worker thread entry point for parallel file analysis.
 * Spawned by CLIAnalyzer when processing large file sets.
 */
import { workerData, parentPort } from 'worker_threads';
import { CLIAnalyzer } from './CLIAnalyzer';
import { CLIArguments } from './ArgumentParser';

interface WorkerInput {
  files: string[];
  args: CLIArguments;
}

const { files, args } = workerData as WorkerInput;
const analyzer = new CLIAnalyzer(args);

// analyzeFiles runs sequentially here because isMainThread === false in worker context
analyzer.analyzeFiles(files)
  .then(results => parentPort!.postMessage(results))
  .catch(() => parentPort!.postMessage([]));
