import type { EvalRunOptions, EvalRunResult, CaseResult, GoldenDataset } from './types';
import { trajectoryScore } from './agent-trajectory';
import { precisionAtK } from './retrieval-metrics';

export type CaseRunner = (input: {
  id: string;
  input: string;
  /** Optional case metadata passed to the runner. */
  metadata?: Record<string, unknown>;
}) => Promise<{ output: string; toolCalls?: string[]; retrievedIds?: string[] }>;

/**
 * Run a golden dataset against an async runner (your app, agent, or RAG pipeline).
 */
export async function runGoldenDataset(
  dataset: GoldenDataset,
  runner: CaseRunner,
  options?: EvalRunOptions
): Promise<EvalRunResult> {
  const caseResults: CaseResult[] = [];
  const concurrency = Math.max(1, options?.concurrency ?? 1);

  const chunks: (typeof dataset.cases)[] = [];
  for (let i = 0; i < dataset.cases.length; i += concurrency) {
    chunks.push(dataset.cases.slice(i, i + concurrency));
  }

  for (const batch of chunks) {
    const batchOut = await Promise.all(
      batch.map(async (c) => {
        try {
          const result = await runner({
            id: c.id,
            input: c.input,
            metadata: c.metadata,
          });
          let score = 0;
          const details: Record<string, unknown> = {};

          if (c.expectedOutput !== undefined) {
            const out = result.output ?? '';
            const exp = c.expectedOutput;
            const passed =
              out.includes(exp) || out.trim().toLowerCase() === exp.trim().toLowerCase();
            score = passed ? 1 : 0;
            details.outputMatch = passed;
          }

          if (c.expectedToolCalls && c.expectedToolCalls.length > 0) {
            const traj = trajectoryScore(c.expectedToolCalls, result.toolCalls ?? []);
            score = score === 0 ? traj : (score + traj) / 2;
            details.trajectoryScore = traj;
          }

          if (c.expectedRetrievedIds && c.expectedRetrievedIds.length > 0) {
            const rel = new Set(c.expectedRetrievedIds);
            const p = precisionAtK(result.retrievedIds ?? [], rel, 5);
            score = score === 0 ? p : (score + p) / 2;
            details.precisionAt5 = p;
          }

          if (
            c.expectedOutput === undefined &&
            (!c.expectedToolCalls || c.expectedToolCalls.length === 0) &&
            (!c.expectedRetrievedIds || c.expectedRetrievedIds.length === 0)
          ) {
            score = 1;
          }

          const threshold = options?.minAverageScore ?? 0.7;
          return {
            caseId: c.id,
            passed: score >= threshold,
            score,
            details,
          } satisfies CaseResult;
        } catch (e) {
          return {
            caseId: c.id,
            passed: false,
            score: 0,
            error: e instanceof Error ? e.message : String(e),
          } satisfies CaseResult;
        }
      })
    );
    caseResults.push(...batchOut);
  }

  const averageScore =
    caseResults.length === 0
      ? 0
      : caseResults.reduce((s, r) => s + r.score, 0) / caseResults.length;

  const minAvg = options?.minAverageScore ?? 0;
  const passed =
    averageScore >= minAvg &&
    caseResults.every((r) => r.passed) &&
    !caseResults.some((r) => r.error);

  return {
    datasetName: dataset.name,
    datasetVersion: dataset.version,
    caseResults,
    averageScore,
    passed,
  };
}
