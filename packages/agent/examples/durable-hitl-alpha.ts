/**
 * Agent OS Alpha — durable HITL demo (order-resolution lite).
 *
 * Run (from packages/agent after build):
 *   npx ts-node --transpile-only examples/durable-hitl-alpha.ts
 *
 * Demonstrates: execute → SUSPENDED (worker free) → approveAndResume → COMPLETED
 * across a simulated process restart using file-backed stores.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRuntime } from '../src/runtime/agent.runtime';
import { Agent } from '../src/decorators/agent.decorator';
import { Tool } from '../src/decorators/tool.decorator';
import { createDurableRunStore } from '../src/run/durable-run-store';
import { AgentRunStatus } from '../src/run/agent-run.types';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../src/types/llm.types';

@Agent({
  name: 'order-desk',
  description: 'Minimal order desk for Alpha demo',
  systemPrompt: 'Help with order refunds.',
})
class OrderDeskAgent {
  @Tool({ name: 'refund', description: 'Refund an order', requiresApproval: true })
  async refund(input: { orderId: string; amount: number }): Promise<{ refunded: boolean }> {
    // eslint-disable-next-line no-console
    console.log('Refund executed:', input);
    return { refunded: true };
  }
}

function mockLlm(): LLMProvider {
  let n = 0;
  return {
    async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
      n += 1;
      if (n === 1) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: {
                name: 'refund',
                arguments: JSON.stringify({ orderId: 'ORD-100', amount: 29.99 }),
              },
            },
          ],
        };
      }
      return { content: 'Refund completed after approval.', finishReason: 'stop' };
    },
  };
}

async function main(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-alpha-'));
  const store = createDurableRunStore(dir);
  const llm = mockLlm();

  const runtimeA = new AgentRuntime({
    llmProvider: llm,
    durableSuspend: true,
    enableRetry: false,
    enableCircuitBreaker: false,
    runRepository: store.runRepository,
    checkpointService: store.checkpointService,
    humanTaskService: store.humanTaskService,
  });
  runtimeA.registerAgent(OrderDeskAgent);
  runtimeA.registerAgentInstance('order-desk', new OrderDeskAgent());

  const waiting = await runtimeA.execute('order-desk', 'Please refund ORD-100');
  // eslint-disable-next-line no-console
  console.log('Phase 1 — waiting:', waiting.state, waiting.executionId);
  // eslint-disable-next-line no-console
  console.log('Run status:', (await runtimeA.getRun(waiting.executionId))?.status);

  // Simulate process restart (same LLM counter so post-tool step answers)
  const runtimeB = new AgentRuntime({
    llmProvider: llm,
    durableSuspend: true,
    enableRetry: false,
    enableCircuitBreaker: false,
    runRepository: store.runRepository,
    checkpointService: store.checkpointService,
    humanTaskService: store.humanTaskService,
  });
  runtimeB.registerAgent(OrderDeskAgent);
  runtimeB.registerAgentInstance('order-desk', new OrderDeskAgent());

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
