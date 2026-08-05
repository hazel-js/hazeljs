/**
 * SqlA2ATaskStore branch coverage
 */

import { SqlA2ATaskStore } from '../../src/a2a/sql-a2a-task.store';
import type { PrismaAgentRunClientLike } from '../../src/run/sql-run-client.types';
import type { A2ATask } from '../../src/a2a/a2a.types';

function createA2AClient(withDelete = true): PrismaAgentRunClientLike & {
  _a2a: Map<string, Record<string, unknown>>;
} {
  const a2a = new Map<string, Record<string, unknown>>();
  const delegate: Record<string, unknown> = {
    create: jest.fn(async (args: unknown) => {
      const { data } = args as { data: Record<string, unknown> };
      const row = { ...data };
      a2a.set(String(row.id), row);
      return { ...row };
    }),
    findUnique: jest.fn(async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      const row = a2a.get(where.id);
      return row ? { ...row } : null;
    }),
    findMany: jest.fn(async () => Array.from(a2a.values()).map((r) => ({ ...r }))),
    update: jest.fn(async (args: unknown) => {
      const { where, data } = args as { where: { id: string }; data: Record<string, unknown> };
      const prev = a2a.get(where.id);
      if (!prev) throw new Error('not found');
      const next = { ...prev, ...data };
      a2a.set(where.id, next);
      return { ...next };
    }),
  };
  if (withDelete) {
    delegate.delete = jest.fn(async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      const prev = a2a.get(where.id);
      a2a.delete(where.id);
      return prev;
    });
  }
  return {
    _a2a: a2a,
    agentA2ATask: delegate,
  } as unknown as PrismaAgentRunClientLike & { _a2a: Map<string, Record<string, unknown>> };
}

const sampleTask = (id = 't1'): A2ATask => ({ id, status: { state: 'submitted' } }) as A2ATask;

describe('SqlA2ATaskStore', () => {
  it('requires agentA2ATask model', () => {
    expect(() => new SqlA2ATaskStore({} as PrismaAgentRunClientLike)).toThrow(/agentA2ATask/);
  });

  it('creates, updates, lists, and soft-deletes without delete()', async () => {
    const client = createA2AClient(false);
    const store = new SqlA2ATaskStore(client);

    await store.set(sampleTask('t1'));
    await store.set({ ...sampleTask('t1'), status: { state: 'working' } } as A2ATask);
    expect((await store.get('t1'))?.status.state).toBe('working');
    expect(await store.get('missing')).toBeUndefined();

    client._a2a.set('nullish', { id: 'nullish', taskJson: null, executionId: null });
    const listed = await store.list();
    expect(listed.some((t) => t.id === 't1')).toBe(true);
    expect(listed.some((t) => t.id === 'nullish')).toBe(false);

    expect(await store.delete('missing')).toBe(false);
    expect(await store.delete('t1')).toBe(true);
    expect(client._a2a.get('t1')?.taskJson).toBeNull();
  });

  it('hard-deletes when delete() exists and maps execution ids', async () => {
    const client = createA2AClient(true);
    const store = new SqlA2ATaskStore(client);

    await store.set(sampleTask('t2'));
    expect(await store.delete('t2')).toBe(true);
    expect(client._a2a.has('t2')).toBe(false);

    await store.setExecutionMap('new-map', 'exec_9');
    expect(await store.getExecutionId('new-map')).toBe('exec_9');
    await store.setExecutionMap('new-map', 'exec_10');
    expect(await store.getExecutionId('new-map')).toBe('exec_10');
    expect(await store.getExecutionId('nope')).toBeUndefined();
  });
});
