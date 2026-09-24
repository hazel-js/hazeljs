/**
 * Complexity / risk → execution strategy router.
 */

import type { DecisionExecutionStrategy, DecisionRiskLevel, DecisionStrategyInput } from '../types';

export interface ComplexityRouterInput {
  risk: DecisionRiskLevel;
  choiceCount: number;
  strategy?: DecisionStrategyInput;
  /** DNA may force human-required for critical decisions. */
  forceHumanRequired?: boolean;
  /** Explicit rules mode. */
  rulesMode?: boolean;
}

export function resolveStrategyMode(
  strategy?: DecisionStrategyInput
): DecisionExecutionStrategy | 'auto' | 'rules' | undefined {
  if (!strategy) return undefined;
  if (typeof strategy === 'string') return strategy;
  return strategy.mode;
}

/**
 * Select minimum intelligence for the risk of the decision.
 * Critical cannot be downgraded below human-required when forceHumanRequired.
 */
export function selectExecutionStrategy(input: ComplexityRouterInput): DecisionExecutionStrategy {
  const mode = resolveStrategyMode(input.strategy);

  if (mode === 'rules' || input.rulesMode) {
    return 'rules';
  }

  if (input.forceHumanRequired || input.risk === 'critical') {
    if (mode === 'human-required' || mode === 'auto' || mode === undefined) {
      return 'human-required';
    }
    // Explicit non-human strategies cannot skip HITL for critical when DNA forces it.
    if (input.forceHumanRequired || input.risk === 'critical') {
      return 'human-required';
    }
  }

  if (mode && mode !== 'auto') {
    return mode;
  }

  switch (input.risk) {
    case 'low':
      return input.choiceCount <= 4 ? 'fast' : 'standard';
    case 'medium':
      return 'standard';
    case 'high':
      return 'deliberate';
    default:
      return 'standard';
  }
}

export function strategyIncludesEvidence(strategy: DecisionExecutionStrategy): boolean {
  return strategy === 'standard' || strategy === 'deliberate' || strategy === 'human-required';
}

export function strategyIncludesCandidates(strategy: DecisionExecutionStrategy): boolean {
  return strategy === 'deliberate' || strategy === 'human-required';
}

export function strategyIncludesCritic(strategy: DecisionExecutionStrategy): boolean {
  return strategy === 'deliberate' || strategy === 'human-required';
}
