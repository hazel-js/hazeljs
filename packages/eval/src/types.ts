/**
 * Core types for @hazeljs/eval
 */

import type { LLMJudgeFn } from './llm-judge';

/**
 * Optional provider-call golden shape (used by `@hazeljs/ai` FakeModel matchers).
 * Store under `GoldenCase.metadata.expectedCalls`.
 */
export interface ExpectedCallSlice {
  /** Exact model id if asserted */
  model?: string;
  /** Subset of message roles in order (e.g. ['system','user']) */
  messageRoles?: string[];
  /** Tool / function names expected to be offered on the request */
  toolNames?: string[];
  /** Substring that must appear in some message content */
  messageIncludes?: string;
}

export interface GoldenCase {
  id: string;
  input: string;
  /** Expected final answer (substring or exact match depending on matcher) */
  expectedOutput?: string;
  /** Expected tool / function names in order (agent eval) */
  expectedToolCalls?: string[];
  /** Relevant document IDs or content snippets retrieval should surface */
  expectedRetrievedIds?: string[];
  /**
   * Free-form case metadata. Recognized keys:
   * - `expectedCalls`: ExpectedCallSlice[] for FakeModel request goldens
   * - `judgeContext`: string used when `EvalRunOptions.judgePrompt === 'faithfulness'`
   * - `skipJudge`: boolean to skip LLM judge for this case
   */
  metadata?: Record<string, unknown>;
}

export interface GoldenDataset {
  name: string;
  version: string;
  cases: GoldenCase[];
}

export interface EvalRunOptions {
  /** Max parallel cases (default 1) */
  concurrency?: number;
  /** Fail CI when average score below threshold */
  minAverageScore?: number;
  /**
   * Optional LLM-as-judge. When set, blends judge score with existing matchers
   * (unless `metadata.skipJudge` is true).
   */
  judge?: LLMJudgeFn;
  /** Which rubric prompt to build (default relevance). */
  judgePrompt?: 'relevance' | 'faithfulness';
}

export interface CaseResult {
  caseId: string;
  passed: boolean;
  score: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface EvalRunResult {
  datasetName: string;
  datasetVersion: string;
  caseResults: CaseResult[];
  averageScore: number;
  passed: boolean;
}
