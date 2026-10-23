/**
 * Optional skill handlers for support_desk.
 * Wire these into an embedded AgentOS when not using mock CLI runs.
 */
export const agentName = 'support_desk';

export const skillHandlers = {
  lookup_order: async (input: { orderId?: string }) => ({
    orderId: input?.orderId ?? 'unknown',
    status: 'paid',
    amount: 42,
  }),
  refund: async (input: { orderId?: string; amount?: number }) => ({
    ok: true,
    orderId: input?.orderId,
    amount: input?.amount,
    at: new Date().toISOString(),
  }),
};
