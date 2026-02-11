/**
 * KYC transform step - map JSONPath from raw to normalized
 */

import { get, set } from '../../../utils/jsonpath';
import type { KycSession } from '../../store/store';

export interface TransformMapping {
  from: string;
  to: string;
}

export interface TransformStepConfig {
  mappings: TransformMapping[];
}

/** Transform raw to normalized via JSONPath mappings */
export function runTransformStep(
  session: KycSession,
  config: TransformStepConfig,
): KycSession {
  const normalized = { ...session.normalized };
  for (const m of config.mappings) {
    const val = get(session.raw, m.from);
    set(normalized as Record<string, unknown>, m.to, val);
  }
  return { ...session, normalized };
}
