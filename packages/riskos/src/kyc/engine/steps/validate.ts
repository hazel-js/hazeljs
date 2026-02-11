/**
 * KYC validate step - Ajv JSON Schema validation
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { get } from '../../../utils/jsonpath';
import type { KycSession } from '../../store/store';
import { KycValidationError } from '../../../core/errors';

let ajv: Ajv | null = null;

function getAjv(): Ajv {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
  }
  return ajv;
}

export interface ValidateStepConfig {
  from: string;
  schema: Record<string, unknown>;
}

export interface ValidateResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
}

/** Validate data at path with JSON Schema */
export function runValidateStep(
  session: KycSession,
  config: ValidateStepConfig,
): ValidateResult {
  const data = get(session, config.from);
  const validate = getAjv().compile(config.schema) as ValidateFunction;
  const valid = validate(data);
  if (!valid && validate.errors) {
    const errors = validate.errors.map(e => ({
      path: e.instancePath || config.from,
      message: e.message ?? 'validation failed',
    }));
    return { valid: false, errors };
  }
  return { valid: true };
}

/** Validate and throw on failure */
export function validateAndThrow(
  session: KycSession,
  config: ValidateStepConfig,
): void {
  const result = runValidateStep(session, config);
  if (!result.valid) {
    throw new KycValidationError('Validation failed', result.errors);
  }
}
