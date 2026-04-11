/**
 * @hazeljs/eval — Evaluation toolkit for AI-native HazelJS apps
 */

export type { GoldenCase, GoldenDataset, EvalRunOptions, CaseResult, EvalRunResult } from './types';

export { precisionAtK, recallAtK, meanReciprocalRank, ndcgAtK } from './retrieval-metrics';

export {
  evaluateRetrieval,
  answerContextOverlap,
  type RagRetrievalEvalInput,
  type RagRetrievalEvalResult,
} from './rag-metrics';

export { trajectoryScore, toolCallAccuracy, type AgentTrajectory } from './agent-trajectory';

export {
  parseJudgeScore,
  buildRelevanceJudgePrompt,
  buildFaithfulnessJudgePrompt,
  type JudgeScore,
  type LLMJudgeFn,
} from './llm-judge';

export { runGoldenDataset, type CaseRunner } from './golden-runner';

export { reportEvalForCi, type CiReporterOptions } from './ci-reporter';

export { loadGoldenDatasetFromJson } from './dataset-loader';
