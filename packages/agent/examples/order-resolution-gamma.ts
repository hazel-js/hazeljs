/**
 * Agent OS Gamma — order-resolution reference (AOS-013).
 *
 * Multi-agent: order-desk → fraud-check (callAgent) → refund (HITL) → complete.
 * Uses file durable store + worker leases + capabilities + budget.
 *
 * Run (from packages/agent after build):
 *   npx ts-node --transpile-only examples/order-resolution-gamma.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRuntime } from '../src/runtime/agent.runtime';
import { Agent } from '../src/decorators/agent.decorator';
import { Tool } from '../src/decorators/tool.decorator';
import { createDurableRunStore } from '../src/run/durable-run-store';
import { AgentRunStatus } from '../src/run/agent-run.types';
import { RepositoryAgentRunLeaseService } from '../src/run/agent-run-lease';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../src/types/llm.types';

@Agent({
  name: 'fraud-check',
  description: 'Scores refund risk',
  systemPrompt: 'Return a short fraud assessment.',
  capabilities: ['fraud.read'],
  version: '1.0.0',
})
class FraudCheckAgent {
  @Tool({
    name: 'score_order',
    description: 'Score fraud risk for an order',
    capability: 'fraud.read',
  })
  async score_order(input: { orderId: string }): Promise<{ risk: string; score: number }> {
    return { risk: input.orderId.startsWith('ORD-9') ? 'high' : 'low', score: 0.12 };
  }
}

@Agent({
  name: 'order-desk',
  description: 'Order desk with fraud delegation and refund approval',
  systemPrompt: 'Help with order refunds. Check fraud before refunding.',
  capabilities: ['orders.read', 'payments.write', 'fraud.read'],
  version: '1.0.0',
})
class OrderDeskAgent {
  @Tool({
    name: 'lookup_order',
    description: 'Lookup order details',
    capability: 'orders.read',
  })
  async lookup_order(input: { orderId: string }): Promise<{ orderId: string; total: number }> {
    return { orderId: input.orderId, total: 29.99 };
  }

  @Tool({
    name: 'refund',
    description: 'Refund an order',
    requiresApproval: true,
    capability: 'payments.write',
  })
  async refund(input: { orderId: string; amount: number }): Promise<{ refunded: boolean }> {
    // eslint-disable-next-line no-console
    console.log('Refund executed:', input);
    return { refunded: true };
  }
}

function scriptedLlm(): LLMProvider {
  let n = 0;
  return {
    async chat(req: LLMChatRequest): Promise<LLMChatResponse> {
      n += 1;
      const agentHint = JSON.stringify(req.messages ?? []).includes('fraud') ? 'fraud' : 'desk';
      if (agentHint === 'fraud' || n === 2) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: `c_fraud_${n}`,
              type: 'function',
              function: {
                name: 'score_order',
                arguments: JSON.stringify({ orderId: 'ORD-100' }),
              },
            },
          ],
        };
      }
      if (n === 1) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: {
                name: 'lookup_order',
                arguments: JSON.stringify({ orderId: 'ORD-100' }),
              },
            },
          ],
        };
      }
      if (n === 3) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: 'c3',
              type: 'function',
              function: {
                name: 'refund',
                arguments: JSON.stringify({ orderId: 'ORD-100', amount: 29.99 }),
              },
            },
          ],
        };
      }
      return { content: 'Refund completed after fraud check and approval.', finishReason: 'stop' };
    },
  };
}

async function main(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-gamma-'));
  const store = createDurableRunStore(dir);
  const llm = scriptedLlm();

  const runtimeA = new AgentRuntime({
    llmProvider: llm,
    durableSuspend: true,
    enableRetry: false,
    enableCircuitBreaker: false,
    runRepository: store.runRepository,
    checkpointService: store.checkpointService,
    humanTaskService: store.humanTaskService,
    workerId: 'worker-a',
    runLeaseTtlMs: 30_000,
    defaultBudget: { maxTokens: 100_000 },
  });
  runtimeA.registerAgent(OrderDeskAgent);
  runtimeA.registerAgent(FraudCheckAgent);
  runtimeA.registerAgentInstance('order-desk', new OrderDeskAgent());
  runtimeA.registerAgentInstance('fraud-check', new FraudCheckAgent());

  // Child fraud call (parent linkage)
  const fraud = await runtimeA.callAgent('fraud-check', 'Score ORD-100', {
    maxSteps: 4,
  });
  // eslint-disable-next-line no-console
  console.log('Fraud child:', fraud.state, fraud.executionId);

  const waiting = await runtimeA.execute('order-desk', 'Please refund ORD-100', { maxSteps: 8 });
  // eslint-disable-next-line no-console
  console.log('Phase 1 — waiting:', waiting.state, waiting.executionId);
  const runWaiting = await store.runRepository.get(waiting.executionId);
  // eslint-disable-next-line no-console
  console.log('Lease released on suspend:', !runWaiting?.leaseOwner, 'status:', runWaiting?.status);

  // Simulate worker crash reclaim on a synthetic RUNNING lease
  await store.runRepository.create({ id: 'zombie', agentName: 'order-desk' });
  await store.runRepository.updateStatus('zombie', AgentRunStatus.RUNNING, {
    leaseOwner: 'dead-worker',
    leaseToken: 'old',
    leaseExpiresAt: new Date(Date.now() - 1000),
  });
  const leaseSvc = new RepositoryAgentRunLeaseService(store.runRepository);
  const reclaimed = await leaseSvc.reclaimExpired();
  // eslint-disable-next-line no-console
  console.log(
    'Reclaimed zombies:',
    reclaimed.map((r) => `${r.id}:${r.status}`)
  );

  // Restart worker B
  const runtimeB = new AgentRuntime({
    llmProvider: llm,
    durableSuspend: true,
    enableRetry: false,
    enableCircuitBreaker: false,
    runRepository: store.runRepository,
    checkpointService: store.checkpointService,
    humanTaskService: store.humanTaskService,
    workerId: 'worker-b',
    runLeaseTtlMs: 30_000,
  });
  runtimeB.registerAgent(OrderDeskAgent);
  runtimeB.registerAgent(FraudCheckAgent);
  runtimeB.registerAgentInstance('order-desk', new OrderDeskAgent());
  runtimeB.registerAgentInstance('fraud-check', new FraudCheckAgent());

  const done = await runtimeB.approveAndResume(waiting.executionId, {
    approved: true,
    approvedBy: 'ops@example.com',
  });
  // eslint-disable-next-line no-console
  console.log('Phase 2 — done:', done.state, done.response);
  // eslint-disable-next-line no-console
  console.log(
    'Final run:',
    (await store.runRepository.get(waiting.executionId))?.status === AgentRunStatus.COMPLETED
      ? 'COMPLETED'
      : 'unexpected'
  );
  // eslint-disable-next-line no-console
  console.log('Store dir:', dir);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
