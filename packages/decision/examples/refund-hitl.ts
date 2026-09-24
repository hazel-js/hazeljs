/**
 * Demo: refund approval → HITL when confidence / hybrid rules require review.
 *
 * Run: npx tsx examples/refund-hitl.ts
 */

import { InMemoryCheckpointService, InMemoryHumanTaskService } from '@hazeljs/agent';
import { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import { createDecisionRuntime, refundDefinition } from '../src';

async function main(): Promise<void> {
  const gatekeeper = new AgentGatekeeper({
    mode: 'enforce',
    defaultDecision: 'deny',
    policies: [
      {
        id: 'allow-refund',
        version: '1',
        priority: 10,
        match: { tools: ['payments.refund'] },
        rules: { allowWhen: async () => true },
      },
    ],
  });

  const runtime = createDecisionRuntime({
    gatekeeper,
    checkpoints: new InMemoryCheckpointService(),
    humanTasks: new InMemoryHumanTaskService(),
    hybridRules: [{ whenPath: 'amount', gte: 5000, then: 'review', reason: 'amount >= 5000' }],
    capabilityHandlers: {
      'payments.refund': async () => ({ refunded: true }),
    },
  });
  runtime.registry.register({ name: 'refund-approval', ...refundDefinition });

  const result = await runtime.decide({
    name: 'refund-approval',
    objective: refundDefinition.objective!,
    state: {
      amount: 7500,
      refundHistory: { count: 2 },
      customerNotes: 'Please hurry',
    },
    choices: ['approve', 'reject', 'review'] as const,
    risk: 'high',
    provider: 'hazel-agent',
  });

  console.log('Decision:', result.decision);
  console.log('Confidence:', result.confidence.toFixed(3));
  console.log('Policy:', result.policy.outcome, result.policy.reason);
  console.log('HITL required:', result.hitl?.required, 'task:', result.hitl?.taskId);
  console.log('Status:', result.status);

  if (result.hitl?.required) {
    const resumed = await runtime.resumeFromHuman({
      decisionId: result.id,
      runId: result.trace.runId!,
      action: 'override',
      decision: 'approve',
      actor: 'finance-ops',
      reason: 'Verified identity + receipt',
      execute: true,
    });
    console.log('After human override:', resumed.decision, resumed.execution);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
