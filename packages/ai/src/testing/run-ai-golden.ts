import { FakeModel, type FakeModelReply } from './fake-model';
import { matchExpectedCalls, parseExpectedCalls } from './call-matcher';

/** Duck-typed subset of `@hazeljs/eval` GoldenDataset. */
export interface AiGoldenCase {
  id: string;
  input: string;
  expectedOutput?: string;
  expectedToolCalls?: string[];
  expectedRetrievedIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface AiGoldenDataset {
  name: string;
  version: string;
  cases: AiGoldenCase[];
}

export interface AiEvalRunOptions {
  concurrency?: number;
  minAverageScore?: number;
  judge?: (prompt: string) => Promise<string>;
  judgePrompt?: 'relevance' | 'faithfulness';
}

export interface AiEvalRunResult {
  datasetName: string;
  datasetVersion: string;
  caseResults: Array<{
    caseId: string;
    passed: boolean;
    score: number;
    details?: Record<string, unknown>;
    error?: string;
  }>;
  averageScore: number;
  passed: boolean;
}

export type AiGoldenCaseContext = {
  id: string;
  input: string;
  metadata?: Record<string, unknown>;
  fake: FakeModel;
};

export type AiGoldenCaseRunner = (
  ctx: AiGoldenCaseContext
) => Promise<{ output: string; toolCalls?: string[]; retrievedIds?: string[] }>;

export interface RunAiGoldenOptions {
  dataset: AiGoldenDataset;
  caseRunner: AiGoldenCaseRunner;
  /** Scripted FakeModel replies per case (default: single 'ok'). */
  repliesForCase?: (ctx: {
    id: string;
    input: string;
    metadata?: Record<string, unknown>;
  }) => FakeModelReply[];
  options?: AiEvalRunOptions;
}

function loadEval(): {
  runGoldenDataset: (
    dataset: AiGoldenDataset,
    runner: (input: {
      id: string;
      input: string;
      metadata?: Record<string, unknown>;
    }) => Promise<{ output: string; toolCalls?: string[]; retrievedIds?: string[] }>,
    options?: AiEvalRunOptions
  ) => Promise<AiEvalRunResult>;
  reportEvalForCi: (result: AiEvalRunResult, options?: { exitOnFail?: boolean }) => void;
} {
  try {
    // Optional peer — resolve at runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@hazeljs/eval') as ReturnType<typeof loadEval>;
  } catch {
    throw new Error(
      'runAiGolden requires optional peer @hazeljs/eval. Install it: npm i @hazeljs/eval'
    );
  }
}

/**
 * Run a golden dataset with a fresh FakeModel per case and optional
 * `metadata.expectedCalls` subset matching against recorded provider calls.
 */
export async function runAiGolden(opts: RunAiGoldenOptions): Promise<AiEvalRunResult> {
  const { runGoldenDataset } = loadEval();
  return runGoldenDataset(
    opts.dataset,
    async (c) => {
      const replies = opts.repliesForCase?.({
        id: c.id,
        input: c.input,
        metadata: c.metadata,
      }) ?? ['ok'];
      const fake = new FakeModel(replies);
      const result = await opts.caseRunner({
        id: c.id,
        input: c.input,
        metadata: c.metadata,
        fake,
      });

      const expected = parseExpectedCalls(c.metadata);
      if (expected.length > 0) {
        const match = matchExpectedCalls(fake.calls, expected);
        if (!match.ok) {
          throw new Error(
            `expectedCalls mismatch: ${match.failures.map((f) => f.reason).join('; ')}`
          );
        }
      }

      return result;
    },
    opts.options
  );
}

/** Run goldens and set process.exitCode on failure (CI). */
export async function runAiGoldenCi(
  opts: RunAiGoldenOptions & { exitOnFail?: boolean }
): Promise<AiEvalRunResult> {
  const { reportEvalForCi } = loadEval();
  const result = await runAiGolden(opts);
  reportEvalForCi(result, { exitOnFail: opts.exitOnFail !== false });
  return result;
}
