/**
 * RiskOS Investigator Agent Demo
 * Full AI-powered investigator using @hazeljs/riskos-agent + @hazeljs/ai
 *
 * Run: npm run investigator
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
import { MemoryKycStore, MemoryAuditSink } from '@hazeljs/riskos';

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Set OPENAI_API_KEY to run the investigator example');
    process.exit(1);
  }

  console.log('=== RiskOS Investigator Agent Demo ===\n');

  // Setup RiskOS stores (same as KYC demo)
  const kycStore = new MemoryKycStore();
  const auditSink = new MemoryAuditSink();

  // Create a sample KYC session so the investigator has data to query
  const session = await kycStore.create('tenant-1');
  await kycStore.update(session.id, {
    answers: { fullName: 'Jane Doe', email: 'jane@example.com', nationality: 'SE' },
    decision: { status: 'APPROVED', reasons: ['Sanctions clear'] },
  });

  // Write a sample trace to the audit sink (for evidence tool)
  const now = new Date().toISOString();
  await auditSink.write({
    requestId: 'req-1',
    tsStart: now,
    tsEnd: now,
    tenantId: 'tenant-1',
    actor: { userId: 'analyst-1', role: 'compliance' },
    purpose: 'kyc',
    actionName: 'kyc.onboarding',
    integrity: { hash: 'abc123', prevHash: '' },
  });

  // Create investigator runtime with AI + RiskOS tools
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

  // Run investigation
  console.log('🔍 Investigating case...\n');

  const result = await runInvestigator(runtime, {
    caseId: 'case-123',
    question: `What is the KYC status for session ${session.id}? Summarize any available evidence.`,
  });

  console.log('Response:', result.response);
  console.log(`\nCompleted in ${result.steps} steps (${result.duration}ms)`);
}

main().catch(console.error);
