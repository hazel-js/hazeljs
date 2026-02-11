/**
 * KYC verify step - standard check types + custom
 */

import { get } from '../../../utils/jsonpath';
import type { KycSession } from '../../store/store';

export type CheckType = 'sanctions' | 'doc_verify' | 'address' | 'custom';

export interface VerifyStepConfig {
  checkType: CheckType;
  resultPath: string;
  expectedPath?: string;
  checkName: string;
}

export interface CheckResult {
  ok: boolean;
  match?: boolean;
  confidence?: number;
  issues?: string[];
}

/** Run verify step - produces check result */
export function runVerifyStep(
  session: KycSession,
  config: VerifyStepConfig,
): KycSession {
  const result = get(session.raw, config.resultPath) as Record<string, unknown> | undefined;
  const checks = { ...session.checks };
  let checkResult: CheckResult = { ok: false };
  if (result) {
    const ok = Boolean(result.match ?? result.ok ?? result.status === 'pass');
    const match = result.match as boolean | undefined;
    const confidence = result.confidence as number | undefined;
    const issues = result.issues as string[] | undefined;
    checkResult = { ok, match, confidence, issues };
  }
  checks[config.checkName] = checkResult;
  return { ...session, checks };
}
