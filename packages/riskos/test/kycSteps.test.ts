/**
 * KYC step tests - ask, decide, transform, verify
 */

import { runAskStep } from '../src/kyc/engine/steps/ask';
import { runDecideStep } from '../src/kyc/engine/steps/decide';
import { runTransformStep } from '../src/kyc/engine/steps/transform';
import { runVerifyStep } from '../src/kyc/engine/steps/verify';
import type { KycSession } from '../src';

const baseSession: KycSession = {
  id: 's1',
  tenantId: 't1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  answers: {},
  documents: {},
  raw: {},
  normalized: {},
  checks: {},
};

describe('KYC Ask Step', () => {
  it('returns message when field is empty', () => {
    const res = runAskStep(baseSession, {
      fieldPath: 'email',
      message: 'Enter email',
      inputType: 'text',
    });
    expect(res.message).toBe('Enter email');
    expect(res.fieldPath).toBe('email');
    expect(res.inputType).toBe('text');
  });

  it('returns empty message when field has value', () => {
    const session = { ...baseSession, answers: { email: 'u@test.com' } };
    const res = runAskStep(session, { fieldPath: 'email', message: 'Enter email' });
    expect(res.message).toBe('');
    expect(res.fieldPath).toBe('email');
  });

  it('returns empty when nested path has value', () => {
    const session = { ...baseSession, answers: { address: { city: 'NYC' } } };
    const res = runAskStep(session, { fieldPath: 'address.city', message: 'City?' });
    expect(res.message).toBe('');
  });

  it('returns options for select input', () => {
    const res = runAskStep(baseSession, {
      fieldPath: 'country',
      message: 'Country?',
      inputType: 'select',
      options: ['US', 'UK'],
    });
    expect(res.options).toEqual(['US', 'UK']);
    expect(res.inputType).toBe('select');
  });
});

describe('KYC Decide Step', () => {
  it('applies first matching rule', () => {
    const session = {
      ...baseSession,
      answers: { status: 'approved' },
      normalized: {},
    };
    const result = runDecideStep(session, {
      ruleset: {
        rules: [
          { when: { path: 'status', eq: 'approved' }, reason: 'OK', status: 'APPROVED' },
          { when: { path: 'status', eq: 'rejected' }, reason: 'Nope', status: 'REJECTED' },
        ],
        defaultStatus: 'PENDING',
      },
    });
    expect(result.decision).toEqual({ status: 'APPROVED', reasons: ['OK'] });
  });

  it('returns defaultStatus when no rule matches', () => {
    const session = { ...baseSession, answers: { x: 1 }, normalized: {} };
    const result = runDecideStep(session, {
      ruleset: {
        rules: [{ when: { path: 'y', eq: 2 }, reason: 'nope', status: 'X' }],
        defaultStatus: 'PENDING',
      },
    });
    expect(result.decision?.status).toBe('PENDING');
  });
});

describe('KYC Transform Step', () => {
  it('maps raw fields to normalized', () => {
    const session = {
      ...baseSession,
      raw: { sanctions: { match: false, status: 'clear' } },
    };
    const result = runTransformStep(session, {
      mappings: [
        { from: 'sanctions.match', to: 'sanctionsMatch' },
        { from: 'sanctions.status', to: 'sanctionsStatus' },
      ],
    });
    expect(result.normalized).toEqual({ sanctionsMatch: false, sanctionsStatus: 'clear' });
  });

  it('handles missing source path', () => {
    const result = runTransformStep(baseSession, {
      mappings: [{ from: 'missing.path', to: 'out' }],
    });
    expect(result.normalized).toEqual({ out: undefined });
  });
});

describe('KYC Verify Step', () => {
  it('sets ok from result.match', () => {
    const session = {
      ...baseSession,
      raw: { sanctions: { match: false, status: 'clear' } },
    };
    const result = runVerifyStep(session, {
      checkType: 'sanctions',
      resultPath: 'sanctions',
      checkName: 'sanctions_check',
    });
    expect(result.checks.sanctions_check).toEqual({ ok: false, match: false });
  });

  it('sets ok from result.ok', () => {
    const session = { ...baseSession, raw: { doc: { ok: true } } };
    const result = runVerifyStep(session, {
      checkType: 'doc_verify',
      resultPath: 'doc',
      checkName: 'doc_check',
    });
    expect(result.checks.doc_check?.ok).toBe(true);
  });

  it('sets ok from result.status === pass', () => {
    const session = { ...baseSession, raw: { addr: { status: 'pass' } } };
    const result = runVerifyStep(session, {
      checkType: 'address',
      resultPath: 'addr',
      checkName: 'addr_check',
    });
    expect(result.checks.addr_check?.ok).toBe(true);
  });

  it('sets ok false when result missing', () => {
    const result = runVerifyStep(baseSession, {
      checkType: 'sanctions',
      resultPath: 'missing',
      checkName: 'c',
    });
    expect(result.checks.c).toEqual({ ok: false });
  });
});
