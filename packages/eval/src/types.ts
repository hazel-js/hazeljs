/**
 * Core types for @hazeljs/eval
 */

export interface GoldenCase {
  id: string;
  input: string;
  /** Expected final answer (substring or exact match depending on matcher) */
  expectedOutput?: string;
  /** Expected tool / function names in order (agent eval) */
  expectedToolCalls?: string[];
  /** Relevant document IDs or content snippets retrieval should surface */
  expectedRetrievedIds?: string[];
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
