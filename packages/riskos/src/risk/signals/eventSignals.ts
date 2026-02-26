/**
 * Event signals for risk scoring
 */

import type { RiskSignal } from '../scoring/featureTypes';

/** Build state object from signals for rules engine */
export function buildStateFromSignals(signals: RiskSignal[]): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const s of signals) {
    Object.assign(state, s);
  }
  return state;
}
