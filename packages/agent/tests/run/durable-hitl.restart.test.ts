import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { AgentState } from '../../src/types/agent.types';
import { AgentRunStatus } from '../../src/run/agent-run.types';
import { createDurableRunStore } from '../../src/run/durable-run-store';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';
import type { FlowEngineLike } from '../../src/run/flow-hitl-bridge';
import { resetFlowHitlBridgeForTests } from '../../src/run/flow-hitl-bridge';

const refundCalls: Array<Record<string, unknown>> = [];

@Agent({
  name: 'order-alpha',
  description: 'Order resolution alpha agent',
  systemPrompt: 'Resolve orders. Use refund when needed.',
})
class OrderAlphaAgent {
  @Tool({
    name: 'refund',
    description: 'Issue a refund',
    requiresApproval: true,
  })
  async refund(input: Record<string, unknown>): Promise<{ ok: boolean; amount: unknown }> {
    refundCalls.push(input);
    return { ok: true, amount: input.amount };
  }
}

function mockLlmForToolThenAnswer(): LLMProvider {
  let calls = 0;
  return {
    async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
      calls += 1;
      if (calls === 1) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'refund',
                arguments: JSON.stringify({ amount: 42, orderId: 'ord_1' }),
              },
            },
          ],
        };
      }
      return {
        content: 'Refund approved and completed.',
        finishReason: 'stop',
      };
    },
  };
}

function createMemoryFlowEngine(): FlowEngineLike & {
  runs: Map<string, { status: string; state: Record<string, unknown> }>;
} {
  const defs = new Map<string, Parameters<FlowEngineLike['registerDefinition']>[0]>();
  const runs = new Map<
    string,
    { status: string; state: Record<string, unknown>; current: string }
  >();
  let seq = 0;

  const engine: FlowEngineLike & {
    runs: Map<string, { status: string; state: Record<string, unknown> }>;
  } = {
    runs: runs as Map<string, { status: string; state: Record<string, unknown> }>,
    async registerDefinition(def) {
      defs.set(`${def.flowId}@${def.version}`, def);
    },
    async startRun({ flowId, version }) {
      seq += 1;
      const runId = `flow_${seq}`;
      const def = defs.get(`${flowId}@${version}`);
      if (!def) throw new Error('def missing');
      runs.set(runId, { status: 'RUNNING', state: {}, current: def.entry });
      return { runId };
    },
    async tick(runId) {
      const run = runs.get(runId);
      if (!run) throw new Error('missing run');
      const def = [...defs.values()][0];
      const node = def.nodes[run.current];
      const result = await node.handler({ state: run.state });
      if (result.status === 'wait') {
        run.status = 'WAITING';
        return { status: 'WAITING' };
      }
      if (result.status === 'ok') {
        const edge = def.edges.find((e) => e.from === run.current);
        if (edge) {
          run.current = edge.to;
          run.status = 'RUNNING';
          if (result.patch) Object.assign(run.state, result.patch);
          return { status: 'RUNNING' };
        }
        run.status = 'COMPLETED';
        return { status: 'COMPLETED' };
      }
      run.status = 'FAILED';
      return { status: 'FAILED' };
    },
    async resumeRun(runId, payload) {
      const run = runs.get(runId);
      if (!run) throw new Error('missing run');
      run.state._resumePayload = payload as Record<string, unknown>;
      run.status = 'RUNNING';
      return this.tick(runId);
    },
    async getRun(runId) {
      const run = runs.get(runId);
      return run ? { status: run.status } : null;
    },
  };
  return engine;
}

describe('AOS-006 durable HITL restart', () => {
  let tmp: string;

  beforeEach(() => {
    refundCalls.length = 0;
    resetFlowHitlBridgeForTests();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-hitl-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('survives process restart: execute → SUSPENDED → new runtime → approveAndResume → COMPLETED', async () => {
    const store = createDurableRunStore(tmp);
    const llm = mockLlmForToolThenAnswer();

    const runtimeA = new AgentRuntime({
      llmProvider: llm,
      enableRetry: false,
      enableCircuitBreaker: false,
      durableSuspend: true,
      runRepository: store.runRepository,
      checkpointService: store.checkpointService,
      humanTaskService: store.humanTaskService,
    });
    runtimeA.registerAgent(OrderAlphaAgent);
    runtimeA.registerAgentInstance('order-alpha', new OrderAlphaAgent());

    const waiting = await runtimeA.execute('order-alpha', 'Please refund order ord_1', {
      maxSteps: 5,
    });

    expect(waiting.state).toBe(AgentState.WAITING_FOR_APPROVAL);
    expect(refundCalls).toHaveLength(0);

    const runAfterA = await store.runRepository.get(waiting.executionId);
    expect(runAfterA?.status).toBe(AgentRunStatus.SUSPENDED);
    expect(runAfterA?.checkpointId).toBeDefined();

    // Simulate process crash — drop runtimeA, new process with same stores + continued LLM
    const runtimeB = new AgentRuntime({
      llmProvider: llm,
      enableRetry: false,
      enableCircuitBreaker: false,
      durableSuspend: true,
      runRepository: store.runRepository,
      checkpointService: store.checkpointService,
      humanTaskService: store.humanTaskService,
    });
    runtimeB.registerAgent(OrderAlphaAgent);
    runtimeB.registerAgentInstance('order-alpha', new OrderAlphaAgent());

    const done = await runtimeB.approveAndResume(waiting.executionId, {
      approved: true,
      approvedBy: 'ops@hazel',
    });

    expect(done.state).toBe(AgentState.COMPLETED);
    expect(refundCalls).toHaveLength(1);
    expect(refundCalls[0]).toMatchObject({ amount: 42, orderId: 'ord_1' });

    const runFinal = await store.runRepository.get(waiting.executionId);
    expect(runFinal?.status).toBe(AgentRunStatus.COMPLETED);
  });

  it('mirrors HITL on optional FlowEngine peer', async () => {
    const store = createDurableRunStore(path.join(tmp, 'flow'));
    const flow = createMemoryFlowEngine();
    const llm = mockLlmForToolThenAnswer();

    const runtime = new AgentRuntime({
      llmProvider: llm,
      enableRetry: false,
      enableCircuitBreaker: false,
      durableSuspend: true,
      flowEngine: flow,
      runRepository: store.runRepository,
      checkpointService: store.checkpointService,
      humanTaskService: store.humanTaskService,
    });
    runtime.registerAgent(OrderAlphaAgent);
    runtime.registerAgentInstance('order-alpha', new OrderAlphaAgent());

    const waiting = await runtime.execute('order-alpha', 'refund please', { maxSteps: 5 });
    expect(waiting.state).toBe(AgentState.WAITING_FOR_APPROVAL);

    const flowRuns = [...flow.runs.values()];
    expect(flowRuns.some((r) => r.status === 'WAITING')).toBe(true);

    const cp = await store.checkpointService.load(waiting.executionId);
    const flowRunId = (cp?.payload as { flowRunId?: string })?.flowRunId;
    expect(flowRunId).toBeDefined();

    const done = await runtime.approveAndResume(waiting.executionId, {
      approved: true,
      approvedBy: 'ops',
    });
    expect(done.state).toBe(AgentState.COMPLETED);

    const after = await flow.getRun(flowRunId!);
    expect(after?.status).toBe('COMPLETED');
  });

  it('reject via approveAndResume cancels the run without executing the tool', async () => {
    const store = createDurableRunStore(path.join(tmp, 'reject'));
    const runtime = new AgentRuntime({
      llmProvider: mockLlmForToolThenAnswer(),
      enableRetry: false,
      enableCircuitBreaker: false,
      durableSuspend: true,
      runRepository: store.runRepository,
      checkpointService: store.checkpointService,
      humanTaskService: store.humanTaskService,
    });
    runtime.registerAgent(OrderAlphaAgent);
    runtime.registerAgentInstance('order-alpha', new OrderAlphaAgent());

    const waiting = await runtime.execute('order-alpha', 'refund', { maxSteps: 5 });
    const result = await runtime.approveAndResume(waiting.executionId, {
      approved: false,
      approvedBy: 'ops',
    });
    expect(result.state).toBe(AgentState.FAILED);
    expect(refundCalls).toHaveLength(0);
    expect((await store.runRepository.get(waiting.executionId))?.status).toBe(
      AgentRunStatus.CANCELLED
    );
  });
});
