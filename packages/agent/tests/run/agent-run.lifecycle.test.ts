import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { AgentRunStatus } from '../../src/run/agent-run.types';
import { FileAgentRunRepository } from '../../src/run/file-agent-run.repository';
import { InMemoryHumanTaskService } from '../../src/run/human-task.service';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';
import { AgentEventType } from '../../src/types/event.types';

function mockLlm(responses: string[]): LLMProvider {
  let i = 0;
  return {
    async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
      const content = responses[Math.min(i, responses.length - 1)];
      i++;
      return { content, finishReason: 'stop' };
    },
  };
}

describe('AgentRun lifecycle (execute)', () => {
  @Agent({ name: 'run-life-agent', description: 'Lifecycle test', systemPrompt: 'Be brief.' })
  class RunLifeAgent {}

  it('creates RUNNING then COMPLETED AgentRun on execute', async () => {
    const runtime = new AgentRuntime({
      llmProvider: mockLlm(['done']),
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(RunLifeAgent);
    runtime.registerAgentInstance('run-life-agent', new RunLifeAgent());

    const statuses: string[] = [];
    runtime.on(AgentEventType.RUN_STATUS_CHANGED, (e: unknown) => {
      const event = e as { data: { to: string } };
      statuses.push(event.data.to);
    });

    const result = await runtime.execute('run-life-agent', 'hi', { maxSteps: 3 });
    const run = await runtime.getRun(result.executionId);

    expect(run).toBeDefined();
    expect(run!.status).toBe(AgentRunStatus.COMPLETED);
    expect(run!.output).toBeDefined();
    expect(statuses).toContain(AgentRunStatus.RUNNING);
    expect(statuses).toContain(AgentRunStatus.COMPLETED);
  });

  it('suspendRun and resumeRun update status + checkpoint', async () => {
    const runtime = new AgentRuntime({
      llmProvider: mockLlm(['ok']),
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(RunLifeAgent);
    runtime.registerAgentInstance('run-life-agent', new RunLifeAgent());
    const result = await runtime.execute('run-life-agent', 'hi', { maxSteps: 3 });

    // Terminal runs cannot suspend — create a fresh RUNNING run via repository
    const repo = runtime.getRunRepository();
    await repo.create({ id: 'suspend_demo', agentName: 'run-life-agent' });
    await repo.updateStatus('suspend_demo', AgentRunStatus.RUNNING);
    await runtime.suspendRun('suspend_demo', { reason: 'test' });
    let run = await runtime.getRun('suspend_demo');
    expect(run!.status).toBe(AgentRunStatus.SUSPENDED);
    expect(run!.checkpointId).toBeDefined();
    expect((await runtime.getCheckpointService().load('suspend_demo'))?.payload).toEqual({
      reason: 'test',
    });

    await runtime.resumeRun('suspend_demo');
    run = await runtime.getRun('suspend_demo');
    expect(run!.status).toBe(AgentRunStatus.RUNNING);
    expect(result.executionId).toBeTruthy();
  });
});

describe('FileAgentRunRepository', () => {
  it('persists runs to disk', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-runs-'));
    const file = path.join(dir, 'runs.json');
    const repo = new FileAgentRunRepository(file);
    await repo.create({ id: 'f1', agentName: 'a', input: 'x' });
    await repo.updateStatus('f1', AgentRunStatus.RUNNING);
    await repo.updateStatus('f1', AgentRunStatus.COMPLETED, { output: 'y' });

    const again = new FileAgentRunRepository(file);
    const run = await again.get('f1');
    expect(run?.status).toBe(AgentRunStatus.COMPLETED);
    expect(run?.output).toBe('y');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('InMemoryHumanTaskService', () => {
  it('creates and resolves tasks', async () => {
    const svc = new InMemoryHumanTaskService();
    const task = await svc.create({
      runId: 'r1',
      type: 'tool_approval',
      toolName: 'refund',
      metadata: { requestId: 'req_1' },
    });
    expect(task.status).toBe('pending');
    const resolved = await svc.resolve(task.id, 'approved', 'ops');
    expect(resolved.status).toBe('approved');
    expect((await svc.listByRun('r1'))[0].resolvedBy).toBe('ops');
  });
});
