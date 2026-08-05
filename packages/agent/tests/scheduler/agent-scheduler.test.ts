/**
 * AgentScheduler branch coverage
 */

import {
  InMemoryAgentScheduler,
  QueueAgentScheduler,
  type QueueServiceLike,
} from '../../src/scheduler/agent-scheduler';

describe('InMemoryAgentScheduler', () => {
  it('enqueues, schedules, cancels, and invokes handler', async () => {
    const sched = new InMemoryAgentScheduler();
    const seen: string[] = [];
    sched.setHandler((job) => {
      seen.push(job.id);
    });

    const id = await sched.enqueue({
      id: 'j1',
      agentName: 'desk',
      input: 'hi',
    });
    expect(id).toBe('j1');

    const future = await sched.scheduleAt(new Date(Date.now() + 60_000), {
      agentName: 'desk',
      input: 'later',
    });
    expect(await sched.cancel(future)).toBe(true);
    expect(await sched.cancel('missing')).toBe(false);

    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toContain('j1');
  });
});

describe('QueueAgentScheduler', () => {
  it('uses addDelayed when delay > 0, else add; cancel always false', async () => {
    const calls: Array<{ fn: string; args: unknown[] }> = [];
    const queue: QueueServiceLike = {
      add: jest.fn(async (...args: unknown[]) => {
        calls.push({ fn: 'add', args });
      }),
      addDelayed: jest.fn(async (...args: unknown[]) => {
        calls.push({ fn: 'addDelayed', args });
      }),
    };
    const sched = new QueueAgentScheduler(queue, 'q1');
    const payloads: string[] = [];
    sched.setHandler(async (job) => {
      payloads.push(job.id);
    });

    await sched.enqueue({ id: 'now', agentName: 'a', input: 'x' });
    expect(calls.some((c) => c.fn === 'add')).toBe(true);

    await sched.scheduleAt(new Date(Date.now() + 5_000), {
      id: 'later',
      agentName: 'a',
      input: 'y',
    });
    expect(calls.some((c) => c.fn === 'addDelayed')).toBe(true);

    await sched.handleQueuePayload({
      id: 'now',
      agentName: 'a',
      input: 'x',
      scheduledAt: new Date(),
      executeAt: new Date(),
    });
    expect(payloads).toContain('now');
    expect(await sched.cancel('later')).toBe(false);
  });

  it('falls back to add({ delay }) when addDelayed is missing', async () => {
    const add = jest.fn(async () => undefined);
    const queue: QueueServiceLike = { add };
    const sched = new QueueAgentScheduler(queue);
    await sched.scheduleAt(new Date(Date.now() + 2_000), {
      id: 'd1',
      agentName: 'a',
      input: 'z',
    });
    expect(add).toHaveBeenCalledWith(
      'hazel-agent-runs',
      'agent.run',
      expect.objectContaining({ id: 'd1' }),
      expect.objectContaining({ delay: expect.any(Number) })
    );
  });
});
