/**
 * RiskOS Demo - KYC session, risk scoring, evidence pack, policy deny
 */

import {
  createRiskOS,
  MemoryEventBus,
  MemoryAuditSink,
  MemoryKycStore,
  KycEngine,
  MockHttpProvider,
  evaluateRiskRuleset,
  runInvestigatorAgent,
  requireTenant,
  PolicyEngine,
  PolicyDeniedError,
  type KycFlowConfig,
  type RiskRuleset,
} from '@hazeljs/riskos';
import { DecisionStatus } from '@hazeljs/contracts';

async function main() {
  console.log('=== RiskOS Demo ===\n');

  // 1. Setup RiskOS with bus, audit sink, policy engine
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

  // 2. Policy deny when tenantId missing
  console.log('--- Policy deny (missing tenantId) ---');
  try {
    await riskos.run('kyc.onboarding', { purpose: 'kyc' }, () => {
      return 'ok';
    });
  } catch (e) {
    if (e instanceof PolicyDeniedError) {
      console.log('Expected: Policy denied -', e.message);
    }
  }

  // 3. KYC session with mocked provider
  console.log('\n--- KYC session ---');
  const store = new MemoryKycStore();
  const providers = {
    sanctions: new MockHttpProvider('sanctions', {
      mockResponse: { match: false, status: 'clear' },
    }),
  };
  const kycEngine = new KycEngine(store, providers);

  const session = await kycEngine.createSession('tenant-1');
  console.log('Created session:', session.id);

  await kycEngine.answer(session.id, 'email', 'user@example.com');
  await kycEngine.answer(session.id, 'name', 'John Doe');

  const flowConfig: KycFlowConfig = {
    steps: [
      { type: 'validate', config: { from: 'answers', schema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } } },
      { type: 'apiCall', config: { provider: 'sanctions', operation: { method: 'GET', path: '/check' }, storeAt: 'sanctions' } },
      { type: 'transform', config: { mappings: [{ from: 'sanctions.status', to: 'sanctionsStatus' }] } },
      { type: 'decide', config: { ruleset: { rules: [{ when: { path: 'sanctionsStatus', eq: 'clear' }, reason: 'clear', status: 'APPROVED' }], defaultStatus: 'REVIEW' } } },
    ],
  };

  await kycEngine.runFlow(session.id, flowConfig);
  const updated = await kycEngine.getSession(session.id);
  console.log('Decision:', updated?.decision);

  // 4. Risk scoring
  console.log('\n--- Risk scoring ---');
  const ruleset: RiskRuleset = {
    hardBlocks: [{ when: { path: 'country', eq: 'XX' }, reason: 'High-risk country' }],
    score: { start: 0, rules: [{ when: { path: 'amount', gte: 10000 }, add: 20, reason: 'Large amount' }, { when: { path: 'velocity', gte: 5 }, add: 15, reason: 'High velocity' }] },
    thresholds: { approveMax: 30, reviewMax: 70 },
  };
  const scoring = evaluateRiskRuleset(ruleset, { amount: 15000, velocity: 6 });
  console.log('Score:', scoring.score, 'Level:', scoring.level, 'Reasons:', scoring.reasons);

  // 5. Investigator assistant
  console.log('\n--- Investigator assistant ---');
  const invRes = await runInvestigatorAgent({ caseId: 'case-1', question: 'Why was this flagged?', tenantId: 'tenant-1' });
  console.log('Summary:', invRes.summary.slice(0, 80) + '...');

  // 6. Run action with tenant (emits metrics, writes trace)
  console.log('\n--- Run with audit ---');
  const result = await riskos.run(
    'kyc.onboarding',
    { tenantId: 'tenant-1', actor: { userId: 'u1', role: 'admin' }, purpose: 'kyc' },
    (ctx) => {
      ctx.metrics.count('kyc.started', 1);
      ctx.emit({ type: 'decision', name: 'kyc', status: DecisionStatus.APPROVED, score: 25, reasons: ['clear'], evidenceId: 'ev-1' });
      return { ok: true };
    },
  );
  console.log('Result:', result);

  // 7. Build evidence pack
  const pack = await auditSink.buildEvidencePack({ tenantId: 'tenant-1' });
  console.log('\n--- Evidence pack ---');
  console.log('Pack id:', pack.id, 'Traces:', pack.manifest.traceCount);
}

main().catch(console.error);
