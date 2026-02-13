/**
 * KYC decide step - apply DecisionRuleset evaluator
 */

import { evaluateRuleset } from '../rules/evaluator';
import type { KycSession } from '../../store/store';
import type { DecisionRuleset } from '../rules/ruleset';

export interface DecideStepConfig {
  ruleset: DecisionRuleset;
}

/** Run decide step - produces decision on session */
export function runDecideStep(session: KycSession, config: DecideStepConfig): KycSession {
  const state = {
    ...session.answers,
    ...session.normalized,
    checks: session.checks,
  };
  const { status, reasons } = evaluateRuleset(config.ruleset, state);
  return {
    ...session,
    decision: { status, reasons },
  };
}
