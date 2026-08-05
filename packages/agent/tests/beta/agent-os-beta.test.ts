import { PolicyService } from '../../src/policies/policy.service';
import { PolicyEngine } from '../../src/policies/policy.engine';
import { identityHasCapability, type AgentIdentity } from '../../src/identity/agent-identity';
import { RunBudgetTracker, BudgetExceededError } from '../../src/budget/run-budget';
import { InMemoryAgentScheduler } from '../../src/scheduler/agent-scheduler';
import { FileA2ATaskStore, InMemoryA2ATaskStore } from '../../src/a2a/a2a-task.store';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { AgentRunStatus } from '../../src/run/agent-run.types';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('AOS-008 AgentIdentity / PolicyService', () => {
  it('identityHasCapability respects grants and *', () => {
    const id: AgentIdentity = { agentName: 'a', capabilities: ['payments.write'] };
    expect(identityHasCapability(id, 'payments.write')).toBe(true);
    expect(identityHasCapability(id, 'admin')).toBe(false);
    expect(identityHasCapability({ agentName: 'a', capabilities: ['*'] }, 'admin')).toBe(true);
    expect(identityHasCapability({ agentName: 'a', capabilities: [] }, 'admin')).toBe(true);
  });

  it('PolicyService denies missing capability', () => {
    const svc = new PolicyService({ policyEngine: new PolicyEngine() });
    svc.setIdentity({ agentName: 'desk', capabilities: ['orders.read'] });
    const denied = svc.evaluateTool('refund', {}, 'payments.write');
    expect(denied.allowed).toBe(false);
    const allowed = svc.evaluateTool('lookup', {}, 'orders.read');
    expect(allowed.allowed).toBe(true);
  });

  it('runtime PolicyService denies missing capability for registered agent identity', async () => {
    @Agent({
      name: 'cap-agent',
      description: 'cap',
      systemPrompt: 'x',
      capabilities: ['orders.read'],
    })
    class CapAgent {
      @Tool({
        name: 'refund',
        description: 'refund',
        capability: 'payments.write',
      })
      async refund(): Promise<{ ok: boolean }> {
        return { ok: true };
      }
    }

    const runtime = new AgentRuntime({
      llmProvider: {
        async chat(): Promise<LLMChatResponse> {
          return { content: 'done', finishReason: 'stop' };
        },
      },
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(CapAgent);
    runtime.registerAgentInstance('cap-agent', new CapAgent());
    await runtime.execute('cap-agent', 'hi', { maxSteps: 2 });

    const svc = runtime.getPolicyService();
    expect(svc).toBeDefined();
    // Identity from last execute
    expect(svc!.evaluateTool('refund', {}, 'payments.write').allowed).toBe(false);
    expect(svc!.evaluateTool('lookup', {}, 'orders.read').allowed).toBe(true);
  });
});

describe('AOS-012 RunBudget', () => {
  it('throws when token budget exceeded', () => {
    const tracker = new RunBudgetTracker({ maxTokens: 10 });
    tracker.recordLlmUsage({ promptTokens: 6, completionTokens: 2 });
    expect(() => tracker.recordLlmUsage({ promptTokens: 5, completionTokens: 0 })).toThrow(
      BudgetExceededError
    );
  });
});

describe('AOS-010 InMemoryAgentScheduler', () => {
  it('fires delayed job', async () => {
    const sched = new InMemoryAgentScheduler();
    const seen: string[] = [];
    sched.setHandler((job) => {
      seen.push(job.agentName);
    });
    await sched.scheduleAt(new Date(Date.now() + 20), {
      agentName: 'sched-agent',
      input: 'hi',
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(seen).toContain('sched-agent');
  });
});

describe('AOS-009 A2A task store + callAgent', () => {
  it('FileA2ATaskStore survives reload', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2a-'));
    const file = path.join(dir, 'tasks.json');
    const store = new FileA2ATaskStore(file);
    await store.set({
      id: 't1',
      status: { state: 'working', timestamp: new Date().toISOString() },
      history: [],
    });
    await store.setExecutionMap('t1', 'exec_1');
    const again = new FileA2ATaskStore(file);
    expect((await again.get('t1'))?.id).toBe('t1');
    expect(await again.getExecutionId('t1')).toBe('exec_1');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('callAgent sets parentRunId on child', async () => {
    @Agent({ name: 'parent-b', description: 'p', systemPrompt: 'p' })
    class ParentB {}
    @Agent({ name: 'child-b', description: 'c', systemPrompt: 'c' })
    class ChildB {}

    const llm: LLMProvider = {
      async chat(): Promise<LLMChatResponse> {
        return { content: 'ok', finishReason: 'stop' };
      },
    };
    const runtime = new AgentRuntime({
      llmProvider: llm,
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(ParentB);
    runtime.registerAgent(ChildB);
    runtime.registerAgentInstance('parent-b', new ParentB());
    runtime.registerAgentInstance('child-b', new ChildB());

    const parent = await runtime.execute('parent-b', 'start', { maxSteps: 2 });
    const child = await runtime.callAgent('child-b', 'work', {
      parentRunId: parent.executionId,
      maxSteps: 2,
    });
    const childRun = await runtime.getRun(child.executionId);
    expect(childRun?.parentRunId).toBe(parent.executionId);
    expect(childRun?.rootRunId).toBe(parent.executionId);
    expect(childRun?.status).toBe(AgentRunStatus.COMPLETED);
  });

  it('InMemoryA2ATaskStore basic CRUD', async () => {
    const store = new InMemoryA2ATaskStore();
    await store.set({
      id: 'x',
      status: { state: 'submitted', timestamp: new Date().toISOString() },
    });
    expect((await store.list()).length).toBe(1);
    await store.delete('x');
    expect(await store.get('x')).toBeUndefined();
  });
});
