/**
 * AgentRun worker lease tests (Gamma).
 */

import { InMemoryAgentRunRepository } from '../../src/run/agent-run.repository';
import { AgentRunStatus } from '../../src/run/agent-run.types';
import { RepositoryAgentRunLeaseService } from '../../src/run/agent-run-lease';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { AgentErrorCode } from '../../src/errors/agent.error';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';

describe('RepositoryAgentRunLeaseService', () => {
  it('acquires, heartbeats, and releases', async () => {
    const repo = new InMemoryAgentRunRepository();
    await repo.create({ id: 'r1', agentName: 'desk' });
    await repo.updateStatus('r1', AgentRunStatus.RUNNING);
    const leases = new RepositoryAgentRunLeaseService(repo, { defaultTtlMs: 5_000 });

    const a = await leases.tryAcquire('r1', 'worker-a');
    expect(a.acquired).toBe(true);
    expect(a.lease?.owner).toBe('worker-a');

    const held = await leases.tryAcquire('r1', 'worker-b');
    expect(held.acquired).toBe(false);
    expect(held.reason).toBe('held');

    expect(await leases.heartbeat('r1', 'worker-a', a.lease!.token)).toBe(true);
    expect(await leases.heartbeat('r1', 'worker-b', 'wrong')).toBe(false);
    expect(await leases.release('r1', 'worker-a', a.lease!.token)).toBe(true);

    const again = await leases.tryAcquire('r1', 'worker-b');
    expect(again.acquired).toBe(true);
  });

  it('reclaims expired RUNNING leases into SUSPENDED', async () => {
    const repo = new InMemoryAgentRunRepository();
    await repo.create({ id: 'r2', agentName: 'desk' });
    await repo.updateStatus('r2', AgentRunStatus.RUNNING);
    const leases = new RepositoryAgentRunLeaseService(repo, { defaultTtlMs: 1 });

    const a = await leases.tryAcquire('r2', 'dead-worker', 1);
    expect(a.acquired).toBe(true);
    await new Promise((r) => setTimeout(r, 5));

    const reclaimed = await leases.reclaimExpired();
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].status).toBe(AgentRunStatus.SUSPENDED);
    expect(reclaimed[0].leaseOwner).toBeUndefined();

    const b = await leases.tryAcquire('r2', 'worker-b');
    expect(b.acquired).toBe(true);
  });

  it('rejects missing/terminal runs and allows same-owner reacquire', async () => {
    const repo = new InMemoryAgentRunRepository();
    const leases = new RepositoryAgentRunLeaseService(repo);

    expect((await leases.tryAcquire('missing', 'w')).reason).toBe('not_found');
    expect(await leases.heartbeat('missing', 'w', 't')).toBe(false);
    expect(await leases.release('missing', 'w', 't')).toBe(false);

    await repo.create({ id: 'done', agentName: 'desk' });
    await repo.updateStatus('done', AgentRunStatus.RUNNING);
    await repo.updateStatus('done', AgentRunStatus.COMPLETED);
    expect((await leases.tryAcquire('done', 'w')).reason).toBe('terminal');

    await repo.create({ id: 'r3', agentName: 'desk' });
    await repo.updateStatus('r3', AgentRunStatus.RUNNING);
    const first = await leases.tryAcquire('r3', 'same');
    expect(first.acquired).toBe(true);
    const again = await leases.tryAcquire('r3', 'same');
    expect(again.acquired).toBe(true);
    expect(await leases.release('r3', 'same', 'wrong-token')).toBe(false);
  });

  it('reclaims without suspending when suspendOnReclaim is false', async () => {
    const repo = new InMemoryAgentRunRepository();
    await repo.create({ id: 'r4', agentName: 'desk' });
    await repo.updateStatus('r4', AgentRunStatus.RUNNING);
    const leases = new RepositoryAgentRunLeaseService(repo, {
      defaultTtlMs: 1,
      suspendOnReclaim: false,
    });
    await leases.tryAcquire('r4', 'dead', 1);
    await new Promise((r) => setTimeout(r, 5));
    const reclaimed = await leases.reclaimExpired(new Date());
    expect(reclaimed[0].status).toBe(AgentRunStatus.RUNNING);
    expect(reclaimed[0].leaseOwner).toBeUndefined();
  });
});

describe('AgentRuntime worker leases', () => {
  @Agent({ name: 'lease-agent', description: 'lease', systemPrompt: 'Be brief.' })
  class LeaseAgent {}

  function mockLlm(): LLMProvider {
    return {
      async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
        return { content: 'ok', finishReason: 'stop' };
      },
    };
  }

  it('acquires lease during execute when workerId set', async () => {
    const repo = new InMemoryAgentRunRepository();
    const runtime = new AgentRuntime({
      llmProvider: mockLlm(),
      runRepository: repo,
      workerId: 'w1',
      runLeaseTtlMs: 10_000,
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(LeaseAgent);
    runtime.registerAgentInstance('lease-agent', new LeaseAgent());

    const result = await runtime.execute('lease-agent', 'hi', { maxSteps: 2 });
    const run = await repo.get(result.executionId);
    expect(run?.status).toBe(AgentRunStatus.COMPLETED);
    expect(run?.leaseOwner).toBeUndefined();
    expect(runtime.getRunLeaseService()).toBeDefined();
  });

  it('blocks second worker while first holds lease', async () => {
    const repo = new InMemoryAgentRunRepository();
    await repo.create({ id: 'busy', agentName: 'lease-agent' });
    await repo.updateStatus('busy', AgentRunStatus.RUNNING, {
      leaseOwner: 'w-other',
      leaseToken: 'tok',
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    const runtime = new AgentRuntime({
      llmProvider: mockLlm(),
      runRepository: repo,
      workerId: 'w1',
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    // Force acquire path on existing run id via lease service
    const leases = runtime.getRunLeaseService()!;
    const result = await leases.tryAcquire('busy', 'w1');
    expect(result.acquired).toBe(false);
    expect(result.reason).toBe('held');
    expect(AgentErrorCode.LEASE_HELD).toBe('AGENT_LEASE_HELD');
  });
});
