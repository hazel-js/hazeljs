/**
 * Agent OS Gamma — leases + multi-agent order resolution (AOS-013 lite).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { createDurableRunStore } from '../../src/run/durable-run-store';
import { AgentRunStatus } from '../../src/run/agent-run.types';
import { RepositoryAgentRunLeaseService } from '../../src/run/agent-run-lease';
import { AgentState } from '../../src/types/agent.types';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';

@Agent({
  name: 'fraud-gamma',
  description: 'fraud',
  systemPrompt: 'Score risk.',
  capabilities: ['fraud.read'],
})
class FraudGamma {
  @Tool({ name: 'score', description: 'score', capability: 'fraud.read' })
  async score(): Promise<{ risk: string }> {
    return { risk: 'low' };
  }
}

@Agent({
  name: 'order-gamma',
  description: 'desk',
  systemPrompt: 'Refunds.',
  capabilities: ['orders.read', 'payments.write'],
})
class OrderGamma {
  @Tool({
    name: 'refund',
    description: 'refund',
    requiresApproval: true,
    capability: 'payments.write',
  })
  async refund(): Promise<{ refunded: boolean }> {
    return { refunded: true };
  }
}

function toolThenText(toolName: string, args: object, text: string): LLMProvider {
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
              function: { name: toolName, arguments: JSON.stringify(args) },
            },
          ],
        };
      }
      return { content: text, finishReason: 'stop' };
    },
  };
}

describe('Agent OS Gamma', () => {
  it('reclaims expired leases and completes durable HITL order refund across workers', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-gamma-'));
    const store = createDurableRunStore(tmp);

    const leases = new RepositoryAgentRunLeaseService(store.runRepository, { defaultTtlMs: 1 });
    await store.runRepository.create({ id: 'zombie', agentName: 'order-gamma' });
    await store.runRepository.updateStatus('zombie', AgentRunStatus.RUNNING);
    await leases.tryAcquire('zombie', 'dead', 1);
    await new Promise((r) => setTimeout(r, 5));
    const reclaimed = await leases.reclaimExpired();
    expect(reclaimed[0]?.status).toBe(AgentRunStatus.SUSPENDED);

    const llmDesk = toolThenText('refund', {}, 'Refunded.');
    const runtimeA = new AgentRuntime({
      llmProvider: llmDesk,
      durableSuspend: true,
      enableRetry: false,
      enableCircuitBreaker: false,
      runRepository: store.runRepository,
      checkpointService: store.checkpointService,
      humanTaskService: store.humanTaskService,
      workerId: 'worker-a',
    });
    runtimeA.registerAgent(OrderGamma);
    runtimeA.registerAgentInstance('order-gamma', new OrderGamma());

    const waiting = await runtimeA.execute('order-gamma', 'refund please', { maxSteps: 5 });
    expect(waiting.state).toBe(AgentState.WAITING_FOR_APPROVAL);
    const mid = await store.runRepository.get(waiting.executionId);
    expect(mid?.status).toBe(AgentRunStatus.SUSPENDED);
    expect(mid?.leaseOwner).toBeUndefined();

    const llmFraud = toolThenText('score', {}, 'ok');
    const runtimeB = new AgentRuntime({
      llmProvider: llmDesk,
      durableSuspend: true,
      enableRetry: false,
      enableCircuitBreaker: false,
      runRepository: store.runRepository,
      checkpointService: store.checkpointService,
      humanTaskService: store.humanTaskService,
      workerId: 'worker-b',
    });
    runtimeB.registerAgent(OrderGamma);
    runtimeB.registerAgent(FraudGamma);
    runtimeB.registerAgentInstance('order-gamma', new OrderGamma());
    runtimeB.registerAgentInstance('fraud-gamma', new FraudGamma());

    // Child agent with parent linkage
    const fraudRuntime = new AgentRuntime({
      llmProvider: llmFraud,
      enableRetry: false,
      enableCircuitBreaker: false,
      runRepository: store.runRepository,
      workerId: 'worker-b',
    });
    fraudRuntime.registerAgent(FraudGamma);
    fraudRuntime.registerAgentInstance('fraud-gamma', new FraudGamma());
    const child = await fraudRuntime.callAgent('fraud-gamma', 'score', {
      parentRunId: waiting.executionId,
      maxSteps: 3,
    });
    const childRun = await store.runRepository.get(child.executionId);
    expect(childRun?.parentRunId).toBe(waiting.executionId);
    expect(childRun?.rootRunId).toBe(waiting.executionId);

    const done = await runtimeB.approveAndResume(waiting.executionId, {
      approved: true,
      approvedBy: 'ops',
    });
    expect(done.state).toBe(AgentState.COMPLETED);
    expect((await store.runRepository.get(waiting.executionId))?.status).toBe(
      AgentRunStatus.COMPLETED
    );

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
