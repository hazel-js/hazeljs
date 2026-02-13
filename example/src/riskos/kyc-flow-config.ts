/**
 * Shared KYC flow config for chat and full examples
 */

import type { KycFlowConfig } from '@hazeljs/riskos';

export const PERSONAL_INFO_SCHEMA = {
  type: 'object',
  properties: {
    fullName: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    dateOfBirth: { type: 'string', format: 'date' },
    nationality: { type: 'string' },
  },
  required: ['fullName', 'email', 'dateOfBirth', 'nationality'],
};

export const ADDRESS_SCHEMA = {
  type: 'object',
  properties: {
    address: {
      type: 'object',
      properties: {
        street: { type: 'string', minLength: 2 },
        city: { type: 'string', minLength: 2 },
        postalCode: { type: 'string', minLength: 2 },
        country: { type: 'string' },
      },
      required: ['street', 'city', 'postalCode', 'country'],
    },
  },
  required: ['address'],
};

/** Validation blocks - run when all required fields are present */
export const VALIDATION_CHECKPOINTS: Array<{
  requiredFieldPaths: string[];
  schema: Record<string, unknown>;
  from: string;
}> = [
  { requiredFieldPaths: ['fullName', 'email', 'dateOfBirth', 'nationality'], schema: PERSONAL_INFO_SCHEMA, from: 'answers' },
  { requiredFieldPaths: ['address.street', 'address.city', 'address.postalCode', 'address.country'], schema: ADDRESS_SCHEMA, from: 'answers' },
];

function hasAllFields(answers: Record<string, unknown>, paths: string[]): boolean {
  for (const p of paths) {
    const parts = p.split('.');
    let v: unknown = answers;
    for (const part of parts) {
      if (v == null || typeof v !== 'object') return false;
      v = (v as Record<string, unknown>)[part];
    }
    if (v == null || v === '') return false;
  }
  return true;
}

/** First checkpoint that has all required fields (call with incrementing index to get next) */
export function getValidationCheckpoint(
  answers: Record<string, unknown>,
  startIndex = 0
): { checkpoint: typeof VALIDATION_CHECKPOINTS[0]; index: number } | null {
  for (let i = startIndex; i < VALIDATION_CHECKPOINTS.length; i++) {
    const cp = VALIDATION_CHECKPOINTS[i];
    if (hasAllFields(answers, cp.requiredFieldPaths)) {
      return { checkpoint: cp, index: i };
    }
  }
  return null;
}

export const FULL_KYC_FLOW: KycFlowConfig = {
  steps: [
    { type: 'ask', config: { fieldPath: 'fullName', message: 'What is your full legal name as it appears on your ID?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'email', message: 'Please provide your email address.', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'dateOfBirth', message: 'What is your date of birth? (YYYY-MM-DD)', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'nationality', message: 'What is your nationality?', inputType: 'select', options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'OTHER'] } },
    { type: 'ask', config: { fieldPath: 'address.street', message: 'What is your residential address (street and number)?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'address.city', message: 'City?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'address.postalCode', message: 'Postal / ZIP code?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'address.country', message: 'Country of residence?', inputType: 'select', options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'OTHER'] } },
    { type: 'ask', config: { fieldPath: 'idType', message: 'What type of ID will you use for verification?', inputType: 'select', options: ['passport', 'national_id', 'drivers_license'] } },
    { type: 'ask', config: { fieldPath: 'idNumber', message: 'Enter your ID document number (last 4 digits only for demo).', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'taxResidence', message: 'Which country is your tax residence?', inputType: 'select', options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'OTHER'] } },
    { type: 'ask', config: { fieldPath: 'employmentStatus', message: 'What is your employment status?', inputType: 'select', options: ['employed', 'self_employed', 'student', 'retired', 'unemployed', 'other'] } },
    { type: 'ask', config: { fieldPath: 'sourceOfFunds', message: 'What is your primary source of funds?', inputType: 'select', options: ['salary', 'business', 'investment', 'inheritance', 'savings', 'other'] } },
    { type: 'ask', config: { fieldPath: 'isPep', message: 'Are you a Politically Exposed Person (PEP) or close associate?', inputType: 'select', options: ['no', 'yes'] } },
    { type: 'ask', config: { fieldPath: 'purposeOfAccount', message: 'What is the main purpose of this account?', inputType: 'select', options: ['personal_banking', 'investments', 'business', 'receiving_payments', 'other'] } },
    { type: 'validate', config: { from: 'answers', schema: PERSONAL_INFO_SCHEMA } },
    { type: 'validate', config: { from: 'answers', schema: ADDRESS_SCHEMA } },
    { type: 'apiCall', config: { provider: 'sanctions', operation: { method: 'POST', path: '/v1/screen', body: { name: '{{answers.fullName}}', dob: '{{answers.dateOfBirth}}', nationality: '{{answers.nationality}}' } }, storeAt: 'sanctions' } },
    { type: 'apiCall', config: { provider: 'docVerify', operation: { method: 'POST', path: '/v1/verify', body: { idType: '{{answers.idType}}', idNumber: '{{answers.idNumber}}' } }, storeAt: 'docVerify' } },
    { type: 'transform', config: { mappings: [{ from: 'sanctions.match', to: 'sanctionsMatch' }, { from: 'sanctions.status', to: 'sanctionsStatus' }, { from: 'docVerify.verified', to: 'docVerified' }] } },
    { type: 'verify', config: { checkType: 'sanctions', resultPath: 'sanctions', checkName: 'sanctions_check' } },
    { type: 'verify', config: { checkType: 'doc_verify', resultPath: 'docVerify', checkName: 'doc_verify_check' } },
    { type: 'decide', config: { ruleset: { rules: [{ when: { path: 'sanctionsMatch', eq: true }, reason: 'Sanctions list match', status: 'REVIEW' }, { when: { path: 'isPep', eq: 'yes' }, reason: 'PEP status', status: 'REVIEW' }, { when: { path: 'docVerified', eq: false }, reason: 'ID verification failed', status: 'REJECTED' }, { when: { path: 'sanctionsStatus', eq: 'clear' }, reason: 'All checks passed', status: 'APPROVED' }], defaultStatus: 'REVIEW' } } },
  ],
};
