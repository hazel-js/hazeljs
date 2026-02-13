/**
 * PSP Chargeback / Dispute Investigation Example
 * Investigator + evidence pack + transaction timeline for disputed transactions
 *
 * Run: npm run riskos:psp:chargeback
 * Requires: OPENAI_API_KEY
 */

import { AIEnhancedService } from '@hazeljs/ai';
import {
  createInvestigatorRuntime,
  runInvestigator,
  createKycToolFromStore,
  createEvidenceToolFromAuditSink,
  createPlaceholderRiskHistoryTool,
  createPlaceholderTransactionTimelineTool,
} from '@hazeljs/riskos-agent';
import {
  createRiskOS,
  MemoryEventBus,
  MemoryAuditSink,
  MemoryKycStore,
  requireTenant,
  PolicyEngine,
} from '@hazeljs/riskos';

/** Seed dispute-related traces and KYC for the investigation */
async function seedDisputeCase(
  riskos: ReturnType<typeof createRiskOS>,
  auditSink: InstanceType<typeof MemoryAuditSink>,
  kycStore: InstanceType<typeof MemoryKycStore>,
) {
  const session = await kycStore.create('psp-1');
  await kycStore.update(session.id, {
    answers: {
      fullName: 'Erik Nilsson',
      email: 'erik.nilsson@shop.se',
      nationality: 'SE',
      businessName: 'Nordic Crafts AB',
      mcc: '5942',
    },
    decision: { status: 'APPROVED', reasons: ['KYB passed'] },
  });

  const now = new Date().toISOString();
  const traces = [
    {
      requestId: 'txn-001',
      tsStart: now,
      tsEnd: now,
      tenantId: 'psp-1',
      actor: { userId: 'acquirer', role: 'payment' },
      purpose: 'transaction',
      actionName: 'txn.authorize',
      integrity: { hash: 'h1', prevHash: '' },
    },
    {
      requestId: 'disp-001',
      tsStart: now,
      tsEnd: now,
      tenantId: 'psp-1',
      actor: { userId: 'dispute-team', role: 'compliance' },
      purpose: 'dispute',
      actionName: 'dispute.received',
      integrity: { hash: 'h2', prevHash: 'h1' },
    },
  ];

  for (const t of traces) {
    await auditSink.write(t);
  }

  return session;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Set OPENAI_API_KEY to run the chargeback investigator example');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PSP Chargeback / Dispute Investigation');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const bus = new MemoryEventBus();
  const auditSink = new MemoryAuditSink();
  const kycStore = new MemoryKycStore();
  const policyEngine = new PolicyEngine();
  policyEngine.addPolicy(requireTenant());

  const riskos = createRiskOS({
    bus,
    auditSink,
    policyEngine,
    enforcePolicies: true,
  });

  await riskos.run(
    'dispute.seed',
    {
      tenantId: 'psp-1',
      actor: { userId: 'demo', role: 'admin' },
      purpose: 'dispute',
    },
    async () => {
      await seedDisputeCase(riskos, auditSink, kycStore);
      return null;
    },
  );

  const pack = await auditSink.buildEvidencePack({ tenantId: 'psp-1' });
  console.log(`📦 Evidence pack: ${pack.id} | Traces: ${pack.manifest.traceCount}\n`);

  const runtime = createInvestigatorRuntime({
    aiService: new AIEnhancedService(),
    tools: {
      kyc: createKycToolFromStore(kycStore),
      evidence: createEvidenceToolFromAuditSink(auditSink),
      riskHistory: createPlaceholderRiskHistoryTool(),
      transactionTimeline: createPlaceholderTransactionTimelineTool(),
    },
    model: 'gpt-4',
  });

  const question = `Investigate dispute disp-001 for tenant psp-1. What KYC/merchant data do we have? Summarize the evidence pack timeline and whether the dispute appears supportable.`;

  console.log('🔍 Question:', question);
  console.log('');

  const result = await runInvestigator(runtime, {
    caseId: 'disp-001',
    question,
  });

  console.log('--- Investigator Response ---');
  console.log(result.response);
  console.log(`\nCompleted in ${result.steps} steps (${result.duration}ms)`);
}

main().catch(console.error);
