import {
  AgentRunStatus,
  canTransitionAgentRun,
  assertAgentRunTransition,
  AgentRunTransitionError,
  InMemoryAgentRunRepository,
  InMemoryCheckpointService,
} from '../../src/run';

describe('AgentRun transitions', () => {
  it('allows created → running → completed', () => {
    expect(canTransitionAgentRun(AgentRunStatus.CREATED, AgentRunStatus.RUNNING)).toBe(true);
    expect(canTransitionAgentRun(AgentRunStatus.RUNNING, AgentRunStatus.COMPLETED)).toBe(true);
    expect(() =>
      assertAgentRunTransition('r1', AgentRunStatus.COMPLETED, AgentRunStatus.RUNNING)
    ).toThrow(AgentRunTransitionError);
  });

  it('allows waiting_for_human → suspended → running', () => {
    expect(canTransitionAgentRun(AgentRunStatus.WAITING_FOR_HUMAN, AgentRunStatus.SUSPENDED)).toBe(
      true
    );
    expect(canTransitionAgentRun(AgentRunStatus.SUSPENDED, AgentRunStatus.RUNNING)).toBe(true);
  });
});

describe('InMemoryAgentRunRepository', () => {
  it('creates, updates status, and lists runs', async () => {
    const repo = new InMemoryAgentRunRepository();
    const run = await repo.create({ id: 'exec_1', agentName: 'demo', input: 'hi' });
    expect(run.status).toBe(AgentRunStatus.CREATED);
    expect(run.rootRunId).toBe('exec_1');

    const running = await repo.updateStatus('exec_1', AgentRunStatus.RUNNING);
    expect(running.startedAt).toBeDefined();

    const done = await repo.updateStatus('exec_1', AgentRunStatus.COMPLETED, {
      output: 'ok',
    });
    expect(done.status).toBe(AgentRunStatus.COMPLETED);
    expect(done.output).toBe('ok');
    expect(done.completedAt).toBeDefined();

    await expect(repo.updateStatus('exec_1', AgentRunStatus.RUNNING)).rejects.toThrow(
      AgentRunTransitionError
    );

    const listed = await repo.list({ agentName: 'demo' });
    expect(listed).toHaveLength(1);
  });
});

describe('InMemoryCheckpointService', () => {
  it('saves and loads checkpoints', async () => {
    const cps = new InMemoryCheckpointService();
    const a = await cps.save('exec_1', { step: 1 }, 1);
    const b = await cps.save('exec_1', { step: 2 }, 2);
    expect(a.id).not.toBe(b.id);
    expect((await cps.load('exec_1'))?.id).toBe(b.id);
    expect((await cps.load('exec_1', a.id))?.payload).toEqual({ step: 1 });
    expect(await cps.list('exec_1')).toHaveLength(2);
  });
});
