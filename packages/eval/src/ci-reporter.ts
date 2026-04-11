import type { EvalRunResult } from './types';

export interface CiReporterOptions {
  /** When true, exit process with code 1 if eval failed */
  exitOnFail?: boolean;
}

/**
 * Print a human-readable summary and optionally exit with failure for CI.
 */
export function reportEvalForCi(result: EvalRunResult, options?: CiReporterOptions): void {
  // eslint-disable-next-line no-console
  console.log(
    `[hazeljs/eval] ${result.datasetName}@${result.datasetVersion} ` +
      `avg=${result.averageScore.toFixed(3)} passed=${result.passed}`
  );
  for (const c of result.caseResults) {
    // eslint-disable-next-line no-console
    console.log(
      `  - ${c.caseId}: score=${c.score.toFixed(3)} passed=${c.passed}` +
        (c.error ? ` error=${c.error}` : '')
    );
  }
  if (options?.exitOnFail && !result.passed) {
    process.exitCode = 1;
  }
}
