/**
 * RiskOS - Comprehensive KYC Individual Onboarding Example
 *
 * Full flow: questions -> validation -> sanctions check -> doc verify (optional) -> decision
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
import { FULL_KYC_FLOW } from './kyc-flow-config';

// ═══════════════════════════════════════════════════════════════════════════════
// Demo runner
// ═══════════════════════════════════════════════════════════════════════════════

/** Simulated user answers for demo */
const DEMO_ANSWERS: Record<string, unknown> = {
  fullName: 'Anna Andersson',
  email: 'anna.andersson@example.com',
  dateOfBirth: '1985-03-15',
  nationality: 'SE',
  'address.street': 'Storgatan 42',
  'address.city': 'Stockholm',
  'address.postalCode': '111 22',
  'address.country': 'SE',
  idType: 'passport',
  idNumber: '****1234',
  taxResidence: 'SE',
  employmentStatus: 'employed',
  sourceOfFunds: 'salary',
  isPep: 'no',
  purposeOfAccount: 'personal_banking',
};

async function runFullKycExample() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RiskOS - Full KYC Individual Onboarding Example');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Setup
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
    docVerify: new MockHttpProvider('docVerify', {
      mockResponse: {
        verified: true,
        confidence: 0.95,
        idType: 'passport',
      },
    }),
  };

  const kycEngine = new KycEngine(store, providers);

  // 2. Create session
  const session = await kycEngine.createSession('tenant-acme');
  console.log('Session created:', session.id);
  console.log('Tenant: tenant-acme\n');

  // 3. Chat-based question loop - simulate user answering each question
  console.log('--- Step 1: Collecting information ---\n');
  let turn = nextChatTurn(session, FULL_KYC_FLOW);
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
    turn = nextChatTurn(updated, FULL_KYC_FLOW);
    stepNum++;
  }

  console.log(`  ✓ All ${stepNum - 1} questions answered.\n`);

  // 4. Run validation and backend steps (no more ask steps)
  console.log('--- Step 2: Validation & backend checks ---\n');

  await riskos.run(
    'kyc.onboarding.complete',
    {
      tenantId: 'tenant-acme',
      actor: { userId: 'sys', role: 'admin' },
      purpose: 'kyc',
    },
    async () => {
      await kycEngine.runFlow(session.id, FULL_KYC_FLOW);
      return null;
    },
  );

  const finalSession = await kycEngine.getSession(session.id);
  if (!finalSession) throw new Error('Session lost');

  // 5. Output summary
  console.log('--- Step 3: Result ---\n');
  console.log('  Sanctions check:', finalSession.raw?.sanctions);
  console.log('  Doc verify:', finalSession.raw?.docVerify);
  console.log('  Checks:', JSON.stringify(finalSession.checks, null, 2));
  console.log('  Decision:', finalSession.decision);
  console.log('');

  // 6. Evidence pack
  const pack = await auditSink.buildEvidencePack({ tenantId: 'tenant-acme' });
  console.log('--- Evidence ---');
  console.log('  Pack:', pack.id);
  console.log('  Traces:', pack.manifest.traceCount);
}

runFullKycExample().catch(console.error);
