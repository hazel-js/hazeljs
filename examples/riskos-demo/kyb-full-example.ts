/**
 * RiskOS - KYB (Know Your Business) Merchant Onboarding Example
 *
 * Full flow: business info -> processing -> UBO -> validation -> sanctions -> decision
 */

import {
  createRiskOS,
  MemoryEventBus,
  MemoryAuditSink,
  MemoryKycStore,
  KycEngine,
  MockHttpProvider,
  nextChatTurn,
  requireTenant,
  PolicyEngine,
} from '@hazeljs/riskos';
import { FULL_KYB_FLOW } from './kyb-flow-config';

/** Simulated merchant answers for demo */
const DEMO_ANSWERS: Record<string, unknown> = {
  businessName: 'Nordic Crafts AB',
  registrationNumber: '556123-4567',
  country: 'SE',
  legalStructure: 'llc',
  mcc: '5942',
  expectedMonthlyVolume: 50000,
  currency: 'EUR',
  uboName: 'Erik Nilsson',
  uboRole: 'owner',
  uboNationality: 'SE',
};

async function runFullKybExample() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RiskOS - KYB Merchant Onboarding Example');
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

  const store = new MemoryKycStore();
  const providers = {
    sanctions: new MockHttpProvider('sanctions', {
      mockResponse: {
        match: false,
        status: 'clear',
        screenedAt: new Date().toISOString(),
      },
    }),
  };

  const kycEngine = new KycEngine(store, providers);

  const session = await kycEngine.createSession('psp-acme');
  console.log('Session created:', session.id);
  console.log('Tenant: psp-acme\n');

  console.log('--- Step 1: Collecting merchant information ---\n');
  let turn = nextChatTurn(session, FULL_KYB_FLOW);
  let stepNum = 1;

  while (turn && turn.message) {
    const fieldPath = turn.fieldPath;
    const answer = DEMO_ANSWERS[fieldPath];
    const displayValue = answer ?? '(demo: using default)';

    console.log(`  Q${stepNum}: ${turn.message}`);
    console.log(`      → ${fieldPath}: ${displayValue}\n`);

    await kycEngine.answer(session.id, fieldPath, answer ?? `demo-${fieldPath}`);
    const updated = await kycEngine.getSession(session.id);
    if (!updated) break;
    turn = nextChatTurn(updated, FULL_KYB_FLOW);
    stepNum++;
  }

  console.log(`  ✓ All ${stepNum - 1} questions answered.\n`);

  console.log('--- Step 2: Validation & sanctions check ---\n');

  await riskos.run(
    'kyb.onboarding.complete',
    {
      tenantId: 'psp-acme',
      actor: { userId: 'sys', role: 'admin' },
      purpose: 'kyb',
    },
    async () => {
      await kycEngine.runFlow(session.id, FULL_KYB_FLOW);
      return null;
    },
  );

  const finalSession = await kycEngine.getSession(session.id);
  if (!finalSession) throw new Error('Session lost');

  console.log('--- Step 3: Result ---\n');
  console.log('  Sanctions check:', finalSession.raw?.sanctions);
  console.log('  Decision:', finalSession.decision);
  console.log('');

  const pack = await auditSink.buildEvidencePack({ tenantId: 'psp-acme' });
  console.log('--- Evidence ---');
  console.log('  Pack:', pack.id);
  console.log('  Traces:', pack.manifest.traceCount);
}

runFullKybExample().catch(console.error);
