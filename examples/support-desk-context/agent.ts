import { Agent, Tool } from '@hazeljs/agent';
import { assembleContext, rememberPreference } from './context';

const ORDERS: Record<string, { customer: string; item: string; total: number; status: string }> = {
  'ORD-2042': {
    customer: 'Amina R.',
    item: 'Hazel field jacket — size M',
    total: 148,
    status: 'delivered',
  },
  'ORD-1990': {
    customer: 'Jon K.',
    item: 'Agent OS sticker pack',
    total: 12,
    status: 'shipped',
  },
};

export const agentName = 'support_desk_context';

/**
 * Context desk — local Agent OS + CAG/RAG/KAG/Memory planner + HITL refunds.
 */
@Agent({
  name: agentName,
  description: 'Support desk with multi-layer context + HITL refunds',
  systemPrompt: [
    'You are a local order-support desk agent with a context planner.',
    'Call assemble_context before answering policy, handbook, entity, or preference questions.',
    'Use lookup_order for order facts, remember for lasting preferences, issue_refund only when a refund is clearly requested.',
    'Refunds require human approval — never invent approval.',
  ].join(' '),
  maxSteps: 10,
})
export class SupportDeskContextAgent {
  @Tool({
    name: 'assemble_context',
    description:
      'Plan + assemble CAG/RAG/KAG/Memory for a question (logs which sources the planner picked)',
    parameters: [
      { name: 'query', type: 'string', description: 'User question', required: true },
      { name: 'userId', type: 'string', description: 'User id for memory', required: false },
    ],
  })
  async assemble_context({ query, userId }: { query: string; userId?: string }) {
    const assembled = await assembleContext(query, { userId: userId ?? 'desk-user' });
    return {
      sourcesUsed: assembled.sourcesUsed,
      rationale: assembled.plan.rationale,
      text: assembled.text,
      tokenEstimate: assembled.tokenEstimate,
    };
  }

  @Tool({
    name: 'remember',
    description: 'Store a lasting preference for this user (Memory layer)',
    parameters: [
      { name: 'userId', type: 'string', description: 'User id', required: false },
      { name: 'key', type: 'string', description: 'Preference key, e.g. contact_channel', required: true },
      { name: 'value', type: 'string', description: 'Preference value, e.g. email', required: true },
    ],
  })
  async remember({
    userId,
    key,
    value,
  }: {
    userId?: string;
    key: string;
    value: string;
  }) {
    const uid = userId ?? 'desk-user';
    await rememberPreference(uid, key, value);
    return { ok: true, userId: uid, key, value };
  }

  @Tool({
    name: 'lookup_order',
    description: 'Look up an order by id (try ORD-2042)',
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id, e.g. ORD-2042', required: true },
    ],
  })
  async lookup_order({ orderId }: { orderId: string }) {
    const id = (orderId || 'ORD-2042').toUpperCase();
    const order = ORDERS[id];
    if (!order) return { found: false as const, orderId: id };
    return { found: true as const, orderId: id, ...order };
  }

  @Tool({
    name: 'issue_refund',
    description: 'Issue a refund (pauses for human approval)',
    requiresApproval: true,
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id', required: true },
      { name: 'amount', type: 'number', description: 'Refund amount in USD', required: true },
    ],
  })
  async issue_refund({ orderId, amount }: { orderId: string; amount: number }) {
    const id = (orderId || 'ORD-2042').toUpperCase();
    const order = ORDERS[id];
    return {
      ok: true,
      orderId: id,
      amount: amount ?? order?.total ?? 0,
      currency: 'USD',
      ledgerRef: `rfnd_${Date.now().toString(36)}`,
    };
  }
}
