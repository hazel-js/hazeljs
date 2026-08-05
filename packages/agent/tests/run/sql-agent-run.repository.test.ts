/**
 * SqlAgentRunRepository + createSqlDurableRunStore (AOS-014) — mock Prisma client.
 */

import { AgentRunStatus } from '../../src/run/agent-run.types';
import { SqlAgentRunRepository } from '../../src/run/sql-agent-run.repository';
import { SqlCheckpointService } from '../../src/run/sql-checkpoint.service';
import { SqlHumanTaskService } from '../../src/run/sql-human-task.service';
import { createSqlDurableRunStore } from '../../src/run/durable-run-store';
import type { PrismaAgentRunClientLike } from '../../src/run/sql-run-client.types';

function createMockPrisma(): PrismaAgentRunClientLike & {
  _runs: Map<string, Record<string, unknown>>;
  _checkpoints: Map<string, Record<string, unknown>>;
  _tasks: Map<string, Record<string, unknown>>;
  _a2a: Map<string, Record<string, unknown>>;
} {
  const runs = new Map<string, Record<string, unknown>>();
  const checkpoints = new Map<string, Record<string, unknown>>();
  const tasks = new Map<string, Record<string, unknown>>();
  const a2a = new Map<string, Record<string, unknown>>();

  const delegate = (store: Map<string, Record<string, unknown>>) => ({
    create: jest.fn(async (args: unknown) => {
      const { data } = args as { data: Record<string, unknown> };
      const row = { ...data };
      store.set(String(row.id), row);
      return { ...row };
    }),
    findUnique: jest.fn(async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      const row = store.get(where.id);
      return row ? { ...row } : null;
    }),
    findMany: jest.fn(async (args: unknown = {}) => {
      const { where, orderBy, take } = (args ?? {}) as {
        where?: Record<string, unknown>;
        orderBy?: Record<string, string> | Record<string, string>[];
        take?: number;
      };
      let rows = Array.from(store.values()).map((r) => ({ ...r }));
      if (where) {
        rows = rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      }
      if (orderBy) {
        const ob = Array.isArray(orderBy) ? orderBy[0] : orderBy;
        const [key, dir] = Object.entries(ob)[0] ?? [];
        if (key) {
          rows.sort((a, b) => {
            const av = a[key] as string | number | Date;
            const bv = b[key] as string | number | Date;
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return dir === 'desc' ? -cmp : cmp;
          });
        }
      }
      if (take != null) rows = rows.slice(0, take);
      return rows;
    }),
    update: jest.fn(async (args: unknown) => {
      const { where, data } = args as { where: { id: string }; data: Record<string, unknown> };
      const prev = store.get(where.id);
      if (!prev) throw new Error('not found');
      const next = { ...prev, ...data };
      store.set(where.id, next);
      return { ...next };
    }),
    delete: jest.fn(async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      const prev = store.get(where.id);
      store.delete(where.id);
      return prev;
    }),
  });

  return {
    _runs: runs,
    _checkpoints: checkpoints,
    _tasks: tasks,
    _a2a: a2a,
    agentRun: delegate(runs),
    agentRunCheckpoint: delegate(checkpoints),
    agentHumanTask: delegate(tasks),
    agentA2ATask: delegate(a2a),
  };
}

describe('SqlAgentRunRepository', () => {
  it('creates, updates, lists, and reloads runs', async () => {
    const client = createMockPrisma();
    const repo = new SqlAgentRunRepository(client);

    const created = await repo.create({
      id: 'run_1',
      agentName: 'desk',
      input: { q: 1 },
      tenantId: 't1',
    });
    expect(created.status).toBe(AgentRunStatus.CREATED);
    expect(created.rootRunId).toBe('run_1');

    await repo.updateStatus('run_1', AgentRunStatus.RUNNING);
    const running = await repo.get('run_1');
    expect(running?.status).toBe(AgentRunStatus.RUNNING);
    expect(running?.startedAt).toBeInstanceOf(Date);

    await repo.updateStatus('run_1', AgentRunStatus.COMPLETED, { output: 'ok' });
    const done = await repo.get('run_1');
    expect(done?.status).toBe(AgentRunStatus.COMPLETED);
    expect(done?.output).toBe('ok');
    expect(done?.completedAt).toBeInstanceOf(Date);

    const listed = await repo.list({ agentName: 'desk', status: AgentRunStatus.COMPLETED });
    expect(listed).toHaveLength(1);
    expect(client.agentRun.create).toHaveBeenCalled();
  });

  it('rejects duplicate ids and illegal transitions', async () => {
    const client = createMockPrisma();
    const repo = new SqlAgentRunRepository(client);
    await repo.create({ id: 'dup', agentName: 'a' });
    await expect(repo.create({ id: 'dup', agentName: 'a' })).rejects.toThrow(/already exists/);
    await expect(repo.updateStatus('dup', AgentRunStatus.COMPLETED)).rejects.toThrow();
  });

  it('requires agentRun delegate', () => {
    expect(() => new SqlAgentRunRepository({} as PrismaAgentRunClientLike)).toThrow(/agentRun/);
  });
});

describe('SqlCheckpointService + SqlHumanTaskService', () => {
  it('saves/loads checkpoints and resolves human tasks', async () => {
    const client = createMockPrisma();
    const cps = new SqlCheckpointService(client);
    const hts = new SqlHumanTaskService(client);

    const cp = await cps.save('run_x', { step: 1 }, 2);
    expect(cp.runId).toBe('run_x');
    expect((await cps.load('run_x'))?.id).toBe(cp.id);
    expect((await cps.load('run_x', cp.id))?.payload).toEqual({ step: 1 });
    expect(await cps.list('run_x')).toHaveLength(1);

    const task = await hts.create({
      runId: 'run_x',
      type: 'tool_approval',
      toolName: 'refund',
    });
    expect(task.status).toBe('pending');
    const resolved = await hts.resolve(task.id, 'approved', 'ops');
    expect(resolved.status).toBe('approved');
    expect(resolved.resolvedBy).toBe('ops');
    expect(await hts.listByRun('run_x')).toHaveLength(1);
  });

  it('covers checkpoint edge branches (string dates, missing rows, wrong run)', async () => {
    const client = createMockPrisma();
    const cps = new SqlCheckpointService(client);
    expect(() => new SqlCheckpointService({} as PrismaAgentRunClientLike)).toThrow(
      /agentRunCheckpoint/
    );

    const cp = await cps.save('run_y', undefined);
    expect(cp.step).toBeUndefined();
    expect(await cps.load('empty')).toBeUndefined();
    expect(await cps.load('run_y', 'missing-id')).toBeUndefined();

    // Force string createdAt + wrong runId mismatch on load-by-id
    const row = client._checkpoints.get(cp.id)!;
    row.createdAt = new Date(row.createdAt as Date).toISOString();
    expect((await cps.load('run_y', cp.id))?.createdAt).toBeInstanceOf(Date);
    expect(await cps.load('other-run', cp.id)).toBeUndefined();

    const listed = await cps.list('run_y');
    expect(listed[0].createdAt).toBeInstanceOf(Date);
  });

  it('covers human-task constructor, miss, and string date coercion', async () => {
    expect(() => new SqlHumanTaskService({} as PrismaAgentRunClientLike)).toThrow(/agentHumanTask/);
    const client = createMockPrisma();
    const hts = new SqlHumanTaskService(client);
    expect(await hts.get('nope')).toBeUndefined();
    await expect(hts.resolve('nope', 'rejected')).rejects.toThrow(/not found/);

    const task = await hts.create({
      id: 'ht_fixed',
      runId: 'run_z',
      type: 'user_input',
      payload: { q: 1 },
      metadata: { a: 1 },
    });
    const row = client._tasks.get(task.id)!;
    row.createdAt = new Date(row.createdAt as Date).toISOString();
    row.resolvedAt = new Date().toISOString();
    row.toolName = null;
    row.resolvedBy = null;
    row.payload = null;
    row.metadata = null;
    const got = await hts.get(task.id);
    expect(got?.createdAt).toBeInstanceOf(Date);
    expect(got?.resolvedAt).toBeInstanceOf(Date);
    expect(got?.toolName).toBeUndefined();
    expect(await hts.resolve(task.id, 'expired')).toMatchObject({ status: 'expired' });
  });
});

describe('createSqlDurableRunStore', () => {
  it('wires all SQL adapters', async () => {
    const client = createMockPrisma();
    const store = createSqlDurableRunStore(client);
    expect(store.backend).toBe('sql');
    expect(store.dir).toBe('sql://prisma');

    await store.runRepository.create({ id: 'r2', agentName: 'a' });
    await store.checkpointService.save('r2', { n: 1 });
    await store.humanTaskService.create({ runId: 'r2', type: 'review' });
    await store.a2aTaskStore.set({
      id: 't1',
      status: { state: 'submitted' },
    });
    expect(await store.a2aTaskStore.get('t1')).toMatchObject({ id: 't1' });
    await store.a2aTaskStore.setExecutionMap('t1', 'exec_1');
    expect(await store.a2aTaskStore.getExecutionId('t1')).toBe('exec_1');
  });
});
