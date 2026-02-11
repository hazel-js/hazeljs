/**
 * KYC ask step - returns next prompt for UI
 */

import type { KycSession } from '../../store/store';

export interface AskStepConfig {
  fieldPath: string;
  message: string;
  inputType?: 'text' | 'select' | 'file';
  options?: string[];
}

export interface AskResult {
  message: string;
  inputType: string;
  options?: string[];
  fieldPath: string;
}

/** Get next chat turn / form prompt for required field */
export function runAskStep(
  session: KycSession,
  config: AskStepConfig,
): AskResult {
  const value = getPath(session.answers, config.fieldPath);
  if (value != null && value !== '') {
    return { message: '', inputType: config.inputType ?? 'text', fieldPath: config.fieldPath };
  }
  return {
    message: config.message,
    inputType: config.inputType ?? 'text',
    options: config.options,
    fieldPath: config.fieldPath,
  };
}

function getPath(obj: unknown, path: string): unknown {
  let v: unknown = obj;
  for (const p of path.split('.')) {
    if (v == null) return undefined;
    v = (v as Record<string, unknown>)[p];
  }
  return v;
}
