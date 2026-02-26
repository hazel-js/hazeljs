/**
 * Decision ruleset evaluator tests
 */

import { evaluateRuleset } from '../src/kyc/engine/rules/evaluator';

describe('evaluateRuleset', () => {
  it('returns first matching rule status', () => {
    const r = evaluateRuleset(
      {
        rules: [
          { when: { path: 'a', eq: 1 }, reason: 'one', status: 'APPROVED' },
          { when: { path: 'a', eq: 2 }, reason: 'two', status: 'REJECTED' },
        ],
        defaultStatus: 'PENDING',
      },
      { a: 1 },
    );
    expect(r.status).toBe('APPROVED');
    expect(r.reasons).toEqual(['one']);
  });

  it('returns defaultStatus when no rule matches', () => {
    const r = evaluateRuleset(
      {
        rules: [{ when: { path: 'x', eq: 99 }, reason: 'n', status: 'X' }],
        defaultStatus: 'REVIEW',
      },
      { x: 1 },
    );
    expect(r.status).toBe('REVIEW');
    expect(r.reasons).toContain('no rules matched');
  });

  it('handles eq condition', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'status', eq: 'clear' }, reason: 'ok', status: 'APPROVED' }], defaultStatus: 'P' },
      { status: 'clear' },
    );
    expect(r.status).toBe('APPROVED');
  });

  it('handles ne condition', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'bad', ne: true }, reason: 'fine', status: 'APPROVED' }], defaultStatus: 'P' },
      { bad: false },
    );
    expect(r.status).toBe('APPROVED');
  });

  it('handles gte condition', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'score', gte: 80 }, reason: 'high', status: 'PASS' }], defaultStatus: 'P' },
      { score: 85 },
    );
    expect(r.status).toBe('PASS');
  });

  it('handles exists condition', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'token', exists: true }, reason: 'has', status: 'OK' }], defaultStatus: 'P' },
      { token: 'abc' },
    );
    expect(r.status).toBe('OK');
  });

  it('handles contains condition', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'name', contains: 'test' }, reason: 'has test', status: 'OK' }], defaultStatus: 'P' },
      { name: 'test-user' },
    );
    expect(r.status).toBe('OK');
  });

  it('rule without when always matches', () => {
    const r = evaluateRuleset(
      { rules: [{ reason: 'catch', status: 'CATCH' }], defaultStatus: 'P' },
      {},
    );
    expect(r.status).toBe('CATCH');
  });

  it('handles lt condition', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'score', lt: 50 }, reason: 'low', status: 'PASS' }], defaultStatus: 'P' },
      { score: 30 },
    );
    expect(r.status).toBe('PASS');
  });

  it('handles lte condition', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'age', lte: 18 }, reason: 'minor', status: 'REVIEW' }], defaultStatus: 'P' },
      { age: 18 },
    );
    expect(r.status).toBe('REVIEW');
  });

  it('contains skips when value is not string (rule can match)', () => {
    const r = evaluateRuleset(
      { rules: [{ when: { path: 'x', contains: 'a' }, reason: 'has a', status: 'X' }], defaultStatus: 'P' },
      { x: 123 },
    );
    expect(r.status).toBe('X');
  });
});
