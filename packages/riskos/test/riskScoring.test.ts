/**
 * Risk scoring tests
 */

import { evaluateRiskRuleset } from '../src';
import type { RiskRuleset } from '../src';

describe('Risk Scoring', () => {
  it('scoring rules apply correctly', () => {
    const ruleset: RiskRuleset = {
      hardBlocks: [{ when: { path: 'blocked', eq: true }, reason: 'Blocked' }],
      score: {
        start: 10,
        rules: [
          { when: { path: 'amount', gte: 5000 }, add: 15, reason: 'Large' },
          { when: { path: 'newUser', eq: true }, add: 10, reason: 'New' },
        ],
      },
      thresholds: { approveMax: 25, reviewMax: 60 },
    };

    const out1 = evaluateRiskRuleset(ruleset, { amount: 3000, newUser: false });
    expect(out1.score).toBe(10);
    expect(out1.blocked).toBe(false);
    expect(out1.level).toBe('LOW');

    const out2 = evaluateRiskRuleset(ruleset, { amount: 6000, newUser: true });
    expect(out2.score).toBe(35); // 10 + 15 + 10
    expect(out2.reasons).toContain('Large');
    expect(out2.reasons).toContain('New');

    const out3 = evaluateRiskRuleset(ruleset, { blocked: true });
    expect(out3.blocked).toBe(true);
    expect(out3.blockReason).toBe('Blocked');
    expect(out3.score).toBe(100);
  });

  it('hard block with ne condition', () => {
    const r: RiskRuleset = {
      hardBlocks: [{ when: { path: 'country', ne: 'SE' }, reason: 'Non-SE' }],
      score: { start: 0, rules: [] },
      thresholds: { approveMax: 10, reviewMax: 50 },
    };
    expect(evaluateRiskRuleset(r, { country: 'XX' }).blocked).toBe(true);
    expect(evaluateRiskRuleset(r, { country: 'SE' }).blocked).toBe(false);
  });

  it('score rule without when always applies', () => {
    const r: RiskRuleset = {
      hardBlocks: [],
      score: { start: 0, rules: [{ add: 5, reason: 'base' }] },
      thresholds: { approveMax: 10, reviewMax: 50 },
    };
    const out = evaluateRiskRuleset(r, {});
    expect(out.score).toBe(5);
    expect(out.reasons).toContain('base');
  });

  it('contains condition', () => {
    const r: RiskRuleset = {
      hardBlocks: [{ when: { path: 'mcc', contains: '54' }, reason: 'MCC' }],
      score: { start: 0, rules: [] },
      thresholds: { approveMax: 10, reviewMax: 50 },
    };
    expect(evaluateRiskRuleset(r, { mcc: '5411' }).blocked).toBe(true);
  });

  it('gt and lt conditions', () => {
    const r: RiskRuleset = {
      hardBlocks: [],
      score: {
        start: 0,
        rules: [
          { when: { path: 'amount', gt: 1000 }, add: 5, reason: 'Over 1k' },
          { when: { path: 'amount', lt: 100 }, add: -5, reason: 'Under 100' },
        ],
      },
      thresholds: { approveMax: 10, reviewMax: 50 },
    };
    expect(evaluateRiskRuleset(r, { amount: 50 }).score).toBe(-5); // lt 100 matches
    expect(evaluateRiskRuleset(r, { amount: 2000 }).score).toBe(5); // gt 1000 matches
  });

  it('exists condition', () => {
    const r: RiskRuleset = {
      hardBlocks: [],
      score: {
        start: 0,
        rules: [{ when: { path: 'token', exists: true }, add: 10, reason: 'has token' }],
      },
      thresholds: { approveMax: 10, reviewMax: 50 },
    };
    expect(evaluateRiskRuleset(r, { token: 'x' }).score).toBe(10);
    expect(evaluateRiskRuleset(r, {}).score).toBe(0);
  });
});
