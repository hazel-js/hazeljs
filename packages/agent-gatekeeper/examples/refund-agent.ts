/**
 * Refund agent — amount-based approval.
 */
import { AgentGatekeeper, fromFunction, InMemoryAuditSink } from '@hazeljs/agent-gatekeeper';

export const refundPolicy = {
  id: 'refund-agent-stripe-policy',
  version: '1.0.0',
  priority: 100,
  match: {
    agents: ['refund-agent'],
    tools: ['stripe.refund'],
    environments: ['production'],
  },
  rules: {
    allowWhen: ({
      input,
      context,
    }: {
      input: { amount: number; tenantId: string };
      context: { tenantId?: string };
    }) => input.amount <= 100 && input.tenantId === context.tenantId,
    requireApprovalWhen: ({ input }: { input: { amount: number } }) => input.amount > 50,
  },
};

export function createRefundGatekeeper(): AgentGatekeeper {
  return new AgentGatekeeper({
    mode: 'enforce',
    defaultDecision: 'deny',
    policies: [refundPolicy],
    auditSink: new InMemoryAuditSink(),
  });
}

export const refundTool = fromFunction(
  'stripe.refund',
  async (input: { amount: number; orderId: string }) => ({
    status: 'refunded',
    amount: input.amount,
    orderId: input.orderId,
  }),
  { classification: 'write' }
);
