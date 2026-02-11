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
});
