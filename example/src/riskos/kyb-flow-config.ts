/**
 * KYB (Know Your Business) flow - Merchant onboarding for PSPs
 */

import type { KycFlowConfig } from '@hazeljs/riskos';

export const BUSINESS_INFO_SCHEMA = {
  type: 'object',
  properties: {
    businessName: { type: 'string', minLength: 2 },
    registrationNumber: { type: 'string', minLength: 2 },
    country: { type: 'string' },
    legalStructure: { type: 'string' },
  },
  required: ['businessName', 'registrationNumber', 'country', 'legalStructure'],
};

export const PROCESSING_SCHEMA = {
  type: 'object',
  properties: {
    mcc: { type: 'string', minLength: 1 },
    expectedMonthlyVolume: { type: 'number', minimum: 0 },
    currency: { type: 'string' },
  },
  required: ['mcc', 'expectedMonthlyVolume', 'currency'],
};

export const KYB_VALIDATION_CHECKPOINTS = [
  { requiredFieldPaths: ['businessName', 'registrationNumber', 'country', 'legalStructure'], schema: BUSINESS_INFO_SCHEMA, from: 'answers' },
  { requiredFieldPaths: ['mcc', 'expectedMonthlyVolume', 'currency'], schema: PROCESSING_SCHEMA, from: 'answers' },
  { requiredFieldPaths: ['uboName', 'uboRole', 'uboNationality'], schema: { type: 'object', properties: { uboName: {}, uboRole: {}, uboNationality: {} }, required: ['uboName', 'uboRole', 'uboNationality'] }, from: 'answers' },
];

export const FULL_KYB_FLOW: KycFlowConfig = {
  steps: [
    { type: 'ask', config: { fieldPath: 'businessName', message: 'Legal business name as registered?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'registrationNumber', message: 'Company registration / tax ID number?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'country', message: 'Country of incorporation?', inputType: 'select', options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'NL', 'FR', 'OTHER'] } },
    { type: 'ask', config: { fieldPath: 'legalStructure', message: 'Legal structure?', inputType: 'select', options: ['llc', 'plc', 'sole_proprietorship', 'partnership', 'nonprofit', 'other'] } },
    { type: 'ask', config: { fieldPath: 'mcc', message: 'Merchant Category Code (e.g. 5411 for grocery)?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'expectedMonthlyVolume', message: 'Expected monthly processing volume (USD)?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'currency', message: 'Settlement currency?', inputType: 'select', options: ['USD', 'EUR', 'GBP', 'SEK', 'NOK', 'OTHER'] } },
    { type: 'ask', config: { fieldPath: 'uboName', message: 'Ultimate Beneficial Owner (UBO) full name?', inputType: 'text' } },
    { type: 'ask', config: { fieldPath: 'uboRole', message: 'UBO role in the business?', inputType: 'select', options: ['owner', 'director', 'shareholder', 'controller', 'other'] } },
    { type: 'ask', config: { fieldPath: 'uboNationality', message: 'UBO nationality?', inputType: 'select', options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'OTHER'] } },
    { type: 'validate', config: { from: 'answers', schema: BUSINESS_INFO_SCHEMA } },
    { type: 'validate', config: { from: 'answers', schema: PROCESSING_SCHEMA } },
    { type: 'apiCall', config: { provider: 'sanctions', operation: { method: 'POST', path: '/v1/screen', body: { name: '{{answers.businessName}}', registrationNumber: '{{answers.registrationNumber}}', uboName: '{{answers.uboName}}' } }, storeAt: 'sanctions' } },
    { type: 'transform', config: { mappings: [{ from: 'sanctions.match', to: 'sanctionsMatch' }, { from: 'sanctions.status', to: 'sanctionsStatus' }] } },
    { type: 'decide', config: { ruleset: { rules: [{ when: { path: 'sanctionsMatch', eq: true }, reason: 'Sanctions match - merchant under review', status: 'REVIEW' }, { when: { path: 'sanctionsStatus', eq: 'clear' }, reason: 'KYB checks passed', status: 'APPROVED' }], defaultStatus: 'REVIEW' } } },
  ],
};
