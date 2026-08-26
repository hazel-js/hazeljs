/**
 * Branch scorers for speculation winner selection.
 */

export interface BranchExecutionResult {
  branchId: string;
  output: unknown;
  metadata?: Record<string, unknown>;
}

export interface BranchScorer {
  name: string;
  score(result: BranchExecutionResult, context?: Record<string, unknown>): Promise<number> | number;
}

/** Score by output string length (demo / fallback). */
export class HeuristicScorer implements BranchScorer {
  readonly name = 'heuristic';

  score(result: BranchExecutionResult): number {
    const text =
      typeof result.output === 'string' ? result.output : JSON.stringify(result.output ?? '');
    return Math.min(text.length / 100, 1);
  }
}

/** Custom scorer via user function. */
export class CustomScorer implements BranchScorer {
  readonly name = 'custom';

  constructor(
    private readonly fn: (
      result: BranchExecutionResult,
      context?: Record<string, unknown>
    ) => Promise<number> | number
  ) {}

  score(
    result: BranchExecutionResult,
    context?: Record<string, unknown>
  ): Promise<number> | number {
    return this.fn(result, context);
  }
}

/** LLM-as-judge scorer (requires judge function injection). */
export class LlmJudgeScorer implements BranchScorer {
  readonly name = 'llm-judge';

  constructor(
    private readonly judge: (
      output: unknown,
      context?: Record<string, unknown>
    ) => Promise<number> | number
  ) {}

  async score(result: BranchExecutionResult, context?: Record<string, unknown>): Promise<number> {
    const raw = await this.judge(result.output, context);
    return Math.max(0, Math.min(1, raw));
  }
}

export function resolveScorer(
  scorer: 'heuristic' | 'llm-judge' | 'custom' | BranchScorer,
  options?: {
    customFn?: (result: BranchExecutionResult) => number;
    judgeFn?: (output: unknown, context?: Record<string, unknown>) => Promise<number> | number;
  }
): BranchScorer {
  if (typeof scorer !== 'string') {
    return scorer;
  }
  switch (scorer) {
    case 'llm-judge':
      if (!options?.judgeFn) {
        throw new Error('llm-judge scorer requires judgeFn');
      }
      return new LlmJudgeScorer(options.judgeFn);
    case 'custom':
      if (!options?.customFn) {
        throw new Error('custom scorer requires customFn');
      }
      return new CustomScorer(options.customFn);
    case 'heuristic':
    default:
      return new HeuristicScorer();
  }
}
