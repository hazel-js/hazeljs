/**
 * PSP Transaction Risk Scoring Example
 * Real-time approve/review/decline based on amount, velocity, country, MCC
 *
 * Run: npm run psp:transaction
 */

import {
  createRiskOS,
  MemoryEventBus,
  MemoryAuditSink,
  PolicyEngine,
  requireTenant,
  evaluateRiskRuleset,
  type RiskRuleset,
} from '@hazeljs/riskos';
import { DecisionStatus } from '@hazeljs/contracts';

// PSP-style transaction risk ruleset
const TRANSACTION_RULESET: RiskRuleset = {
  hardBlocks: [
    { when: { path: 'country', eq: 'XX' }, reason: 'High-risk country blocked' },
    { when: { path: 'mcc', eq: '7995' }, reason: 'Gambling MCC - policy block' },
    { when: { path: 'velocity24h', gte: 20 }, reason: 'Velocity limit exceeded (20+ txns/24h)' },
  ],
  score: {
    start: 0,
    rules: [
      { when: { path: 'amount', gte: 10000 }, add: 25, reason: 'Large amount ($10k+)' },
      { when: { path: 'amount', gte: 5000 }, add: 15, reason: 'Medium-high amount ($5k+)' },
      { when: { path: 'amount', gte: 1000 }, add: 5, reason: 'Moderate amount ($1k+)' },
      { when: { path: 'velocity1h', gte: 5 }, add: 20, reason: 'High velocity (5+ txns/hour)' },
      { when: { path: 'velocity1h', gte: 3 }, add: 10, reason: 'Elevated velocity (3+ txns/hour)' },
      { when: { path: 'cardCountryMismatch', eq: true }, add: 15, reason: 'Card country mismatch' },
      { when: { path: 'newMerchant', eq: true }, add: 10, reason: 'New merchant (< 30 days)' },
      { when: { path: 'mcc', eq: '5411' }, add: -5, reason: 'Low-risk MCC (grocery)' },
    ],
  },
  thresholds: {
    approveMax: 30,
    reviewMax: 70,
  },
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PSP Transaction Risk Scoring');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const bus = new MemoryEventBus();
  const auditSink = new MemoryAuditSink();
  const policyEngine = new PolicyEngine();
  policyEngine.addPolicy(requireTenant());

  const riskos = createRiskOS({
    bus,
    auditSink,
    policyEngine,
    enforcePolicies: true,
  });

  const scenarios = [
    {
      name: 'Low risk - grocery, small amount',
      txn: { amount: 45, velocity1h: 1, velocity24h: 2, country: 'SE', mcc: '5411', cardCountryMismatch: false, newMerchant: false },
    },
    {
      name: 'Medium - large amount, established merchant',
      txn: { amount: 12000, velocity1h: 1, velocity24h: 5, country: 'DE', mcc: '5812', cardCountryMismatch: false, newMerchant: false },
    },
    {
      name: 'High - velocity spike + large amount',
      txn: { amount: 8000, velocity1h: 6, velocity24h: 15, country: 'UK', mcc: '5942', cardCountryMismatch: true, newMerchant: false },
    },
    {
      name: 'Blocked - high-risk country',
      txn: { amount: 500, velocity1h: 1, velocity24h: 1, country: 'XX', mcc: '5411', cardCountryMismatch: false, newMerchant: false },
    },
    {
      name: 'Blocked - velocity limit',
      txn: { amount: 100, velocity1h: 3, velocity24h: 25, country: 'SE', mcc: '5411', cardCountryMismatch: false, newMerchant: false },
    },
  ];

  for (const scenario of scenarios) {
    const result = evaluateRiskRuleset(TRANSACTION_RULESET, scenario.txn);

    await riskos.run(
      'txn.risk.evaluate',
      {
        tenantId: 'psp-1',
        actor: { userId: 'system', role: 'risk-engine' },
        purpose: 'transaction_risk',
      },
      (ctx) => {
        ctx.emit({
          type: 'decision',
          name: 'txn_risk',
          status: result.blocked ? DecisionStatus.REJECTED : (result.level === 'HIGH' || result.level === 'MEDIUM' ? DecisionStatus.REVIEW : DecisionStatus.APPROVED),
          score: result.score,
          reasons: result.reasons,
          evidenceId: `txn-${Date.now()}`,
        });
        return null;
      }
    );

    const decision = result.blocked ? 'DECLINED' : (result.level === 'HIGH' || result.level === 'MEDIUM') ? 'REVIEW' : 'APPROVE';
    console.log(`📌 ${scenario.name}`);
    console.log(`   Amount: $${scenario.txn.amount} | Velocity: ${scenario.txn.velocity1h}/1h, ${scenario.txn.velocity24h}/24h | Country: ${scenario.txn.country}`);
    console.log(`   Score: ${result.score} | Level: ${result.level} | Decision: ${decision}`);
    if (result.blockReason) console.log(`   Block: ${result.blockReason}`);
    else console.log(`   Reasons: ${result.reasons.join('; ') || 'none'}`);
    console.log('');
  }

  const pack = await auditSink.buildEvidencePack({ tenantId: 'psp-1' });
  console.log('--- Evidence ---');
  console.log(`  Pack: ${pack.id} | Traces: ${pack.manifest.traceCount}`);
}

main().catch(console.error);
