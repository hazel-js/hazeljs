/**
 * Error types tests
 */

import {
  RiskOSError,
  PolicyDeniedError,
  KycValidationError,
  ProviderError,
} from '../src';

describe('RiskOSError', () => {
  it('creates with message and code', () => {
    const e = new RiskOSError('test', 'ERR');
    expect(e.message).toBe('test');
    expect(e.code).toBe('ERR');
    expect(e.name).toBe('RiskOSError');
  });
});

describe('PolicyDeniedError', () => {
  it('extends RiskOSError with policy name', () => {
    const e = new PolicyDeniedError('denied', 'requireTenant');
    expect(e.message).toBe('denied');
    expect(e.policyName).toBe('requireTenant');
    expect(e.code).toBe('POLICY_DENIED');
  });
});

describe('KycValidationError', () => {
  it('includes validation errors', () => {
    const errors = [{ path: '/email', message: 'invalid format' }];
    const e = new KycValidationError('Validation failed', errors);
    expect(e.errors).toEqual(errors);
    expect(e.code).toBe('KYC_VALIDATION');
  });
});

describe('ProviderError', () => {
  it('includes provider and status code', () => {
    const e = new ProviderError('API failed', 'sanctions', 500);
    expect(e.providerName).toBe('sanctions');
    expect(e.statusCode).toBe(500);
  });
});
