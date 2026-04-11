/**
 * Agent evaluation helpers — composes with @hazeljs/eval when installed.
 */

import { trajectoryScore, toolCallAccuracy } from '@hazeljs/eval';

export interface AgentEvalCase {
  id: string;
  input: string;
  expectedToolCalls: string[];
}

export interface AgentEvalResult {
  caseId: string;
  trajectoryScore: number;
  toolAccuracy: number;
}

export function evaluateAgentTrajectory(
  testCase: AgentEvalCase,
  actualToolCalls: string[]
): AgentEvalResult {
  return {
    caseId: testCase.id,
    trajectoryScore: trajectoryScore(testCase.expectedToolCalls, actualToolCalls),
    toolAccuracy: toolCallAccuracy(testCase.expectedToolCalls, actualToolCalls),
  };
}

export { trajectoryScore, toolCallAccuracy };
