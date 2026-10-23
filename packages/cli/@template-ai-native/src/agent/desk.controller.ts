import { Body, Controller, Post, Service } from '@hazeljs/core';
import { Agent, Tool, AgentService } from '@hazeljs/agent';
import { assembleContext, rememberPreference } from '../context/desk-context';

/**
 * HTTP-hosted support desk agent with ContextService tools.
 * For local hazeld (apply / HITL daemon): hazel new agent … --template=context
 */
@Agent({
  name: 'SupportDeskAgent',
  description: 'Order support desk with CAG/RAG/KAG/Memory context planner',
  systemPrompt: [
    'You are a support desk agent.',
    'Call assemble_context before answering policy, handbook, entity, or preference questions.',
    'Use remember for lasting preferences and lookup_order for order facts.',
  ].join(' '),
  maxSteps: 10,
})
@Service()
export class SupportDeskAgent {
  constructor(private readonly agentService: AgentService) {}

  @Tool({
    name: 'assemble_context',
    description: 'Plan + assemble CAG/RAG/KAG/Memory for a question',
    parameters: [
      { name: 'query', type: 'string', description: 'User question', required: true },
      { name: 'userId', type: 'string', description: 'User id for memory', required: false },
    ],
  })
  async assemble_context({ query, userId }: { query: string; userId?: string }) {
    const assembled = await assembleContext(query, { userId: userId ?? 'http-user' });
    return {
      sourcesUsed: assembled.sourcesUsed,
      rationale: assembled.plan.rationale,
      text: assembled.text,
    };
  }

  @Tool({
    name: 'remember',
    description: 'Store a lasting preference (Memory)',
    parameters: [
      { name: 'userId', type: 'string', required: false },
      { name: 'key', type: 'string', required: true },
      { name: 'value', type: 'string', required: true },
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
    const uid = userId ?? 'http-user';
    await rememberPreference(uid, key, value);
    return { ok: true, userId: uid, key, value };
  }

  @Tool({
    name: 'lookup_order',
    description: 'Look up an order by id (try ORD-2042)',
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id', required: true },
    ],
  })
  async lookup_order({ orderId }: { orderId: string }) {
    const orders: Record<string, { customer: string; item: string; total: number; status: string }> =
      {
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
    const id = (orderId || 'ORD-2042').toUpperCase();
    const order = orders[id];
    if (!order) return { found: false as const, orderId: id };
    return { found: true as const, orderId: id, ...order };
  }
}

@Service()
@Controller('/desk')
export class DeskController {
  constructor(private readonly agentService: AgentService) {}

  @Post('/chat')
  async chat(@Body() body: { message: string }) {
    if (!body?.message?.trim()) {
      return { error: 'message is required' };
    }
    const result = await this.agentService.execute('SupportDeskAgent', body.message);
    return {
      response: result.response,
      steps: result.steps?.length ?? 0,
      duration: result.duration,
    };
  }
}
