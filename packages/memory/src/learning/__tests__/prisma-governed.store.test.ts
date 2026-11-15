import {
  createPrismaGovernedMemoryStore,
  PrismaGovernedMemoryStore,
  type GovernedMemoryPrismaClient,
  type GovernedMemoryRow,
} from '../prisma-governed.store';
import type { GovernedMemoryRecord } from '../types';

function makeRow(overrides: Partial<GovernedMemoryRow> = {}): GovernedMemoryRow {
  return {
    id: 'gmem_1',
    tenantId: 't1',
    subjectId: 'u1',
    scope: 'customer',
    type: 'preference',
    content: 'prefers email',
    provenance: { sourceKind: 'user' },
    sourceTrust: 0.9,
    factConfidence: null,
    extractionConfidence: 0.8,
    version: 1,
    status: 'accepted',
    sensitivity: 'normal',
    expiresAt: null,
    lineageIds: ['a'],
    sourceId: 'src-1',
    supersededBy: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    accessCount: 0,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<GovernedMemoryRecord> = {}): GovernedMemoryRecord {
  const row = makeRow();
  return {
    id: row.id,
    tenantId: row.tenantId,
    subjectId: row.subjectId,
    scope: row.scope,
    type: 'preference',
    content: row.content,
    provenance: { sourceKind: 'user' },
    sourceTrust: 0.9,
    version: 1,
    status: 'candidate',
    sensitivity: 'normal',
    lineageIds: [],
    sourceId: null,
    supersededBy: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    accessCount: 0,
    ...overrides,
  };
}

function createMockPrisma(seed: GovernedMemoryRow[] = []) {
  const map = new Map(seed.map((r) => [r.id, { ...r }]));

  const prisma: GovernedMemoryPrismaClient = {
    governedMemoryRecord: {
      create: jest.fn(async ({ data }) => {
        const row = { ...(data as GovernedMemoryRow) };
        map.set(row.id, row);
        return { ...row };
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = map.get(where.id);
        return row ? { ...row } : null;
      }),
      findMany: jest.fn(async ({ where, take } = {}) => {
        let rows = [...map.values()];
        const w = (where ?? {}) as Record<string, unknown>;
        if (w.tenantId) rows = rows.filter((r) => r.tenantId === w.tenantId);
        if (w.sourceId) rows = rows.filter((r) => r.sourceId === w.sourceId);
        if (w.status) rows = rows.filter((r) => r.status === w.status);
        if (w.subjectId) rows = rows.filter((r) => r.subjectId === w.subjectId);
        if (w.scope) rows = rows.filter((r) => r.scope === w.scope);
        if (w.type) rows = rows.filter((r) => r.type === w.type);
        if (w.supersededBy === null) rows = rows.filter((r) => r.supersededBy == null);
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows.map((r) => ({ ...r }));
      }),
      update: jest.fn(async ({ where, data }) => {
        const cur = map.get(where.id)!;
        const next = { ...cur, ...(data as object) } as GovernedMemoryRow;
        map.set(where.id, next);
        return { ...next };
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const w = where as { id: string; version: number };
        const cur = map.get(w.id);
        if (!cur || cur.version !== w.version) return { count: 0 };
        const next = { ...cur, ...(data as object) } as GovernedMemoryRow;
        map.set(w.id, next);
        return { count: 1 };
      }),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  return { prisma, map };
}

const auth = {
  tenantId: 't1',
  actorId: 'u1',
  allowedScopes: ['customer', 'org'],
};

describe('PrismaGovernedMemoryStore', () => {
  it('createPrismaGovernedMemoryStore returns a store', () => {
    const { prisma } = createMockPrisma();
    const store = createPrismaGovernedMemoryStore(prisma);
    expect(store).toBeInstanceOf(PrismaGovernedMemoryStore);
  });

  it('inserts and maps null confidence / source fields', async () => {
    const { prisma } = createMockPrisma();
    const store = new PrismaGovernedMemoryStore(prisma);
    const saved = await store.insert(
      makeRecord({
        factConfidence: undefined,
        extractionConfidence: undefined,
        expiresAt: undefined,
        sourceId: undefined,
        supersededBy: undefined,
      })
    );
    expect(saved.id).toBe('gmem_1');
    expect(prisma.governedMemoryRecord.create).toHaveBeenCalled();
  });

  it('getById returns undefined for missing, wrong tenant, and denied scope', async () => {
    const { prisma } = createMockPrisma([
      makeRow({ id: 'a', tenantId: 't1', scope: 'customer' }),
      makeRow({ id: 'b', tenantId: 't2', scope: 'customer' }),
      makeRow({ id: 'c', tenantId: 't1', scope: 'secret-scope' }),
    ]);
    const store = new PrismaGovernedMemoryStore(prisma);

    expect(await store.getById('missing', auth)).toBeUndefined();
    expect(await store.getById('b', auth)).toBeUndefined();
    expect(await store.getById('c', auth)).toBeUndefined();
    const ok = await store.getById('a', auth);
    expect(ok?.id).toBe('a');
  });

  it('getById allows wildcard scope', async () => {
    const { prisma } = createMockPrisma([makeRow({ id: 'w', scope: 'anything' })]);
    const store = new PrismaGovernedMemoryStore(prisma);
    const hit = await store.getById('w', {
      tenantId: 't1',
      actorId: 'u1',
      allowedScopes: ['*'],
    });
    expect(hit?.id).toBe('w');
  });

  it('compareAndSwap returns undefined when row disappears after update', async () => {
    const { prisma } = createMockPrisma([makeRow({ id: 'gone', version: 1, status: 'candidate' })]);
    prisma.governedMemoryRecord.updateMany = jest.fn(async () => ({ count: 1 }));
    prisma.governedMemoryRecord.findUnique = jest.fn(async () => null);
    const store = new PrismaGovernedMemoryStore(prisma);
    const result = await store.compareAndSwap(
      'gone',
      1,
      makeRecord({ id: 'gone', status: 'accepted' })
    );
    expect(result).toBeUndefined();
  });

  it('query filters by subject/scope/type/text and maps odd lineage/provenance', async () => {
    const { prisma } = createMockPrisma([
      makeRow({
        id: '1',
        content: 'prefers email',
        subjectId: 'u1',
        scope: 'customer',
        type: 'preference',
        lineageIds: 'not-array',
        provenance: null,
        factConfidence: 0.5,
        extractionConfidence: 0.6,
      }),
      makeRow({
        id: '2',
        content: 'likes slack',
        subjectId: 'u2',
        scope: 'org',
        type: 'fact',
      }),
      makeRow({
        id: '3',
        content: null,
        subjectId: 'u1',
        scope: 'denied',
        type: 'preference',
      }),
    ]);
    const store = new PrismaGovernedMemoryStore(prisma);

    const all = await store.query({ auth });
    expect(all.some((r) => r.id === '1')).toBe(true);
    expect(all.find((r) => r.id === '1')?.lineageIds).toEqual([]);
    expect(all.find((r) => r.id === '1')?.provenance).toEqual({});
    expect(all.find((r) => r.id === '1')?.factConfidence).toBe(0.5);

    const filtered = await store.query({
      auth,
      subjectId: 'u1',
      scope: 'customer',
      type: 'preference',
      text: 'email',
      limit: 5,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');

    const noTextMatch = await store.query({ auth, text: 'zzzz' });
    expect(noTextMatch.every((r) => r.scope !== 'denied')).toBe(true);
    expect(noTextMatch.find((r) => r.id === '1')).toBeUndefined();
  });

  it('listBySourceId and touch cover hit/miss', async () => {
    const { prisma, map } = createMockPrisma([
      makeRow({ id: 's1', sourceId: 'obs_1', accessCount: 2 }),
    ]);
    const store = new PrismaGovernedMemoryStore(prisma);

    const listed = await store.listBySourceId('t1', 'obs_1');
    expect(listed).toHaveLength(1);

    await store.touch('missing');
    expect(prisma.governedMemoryRecord.update).not.toHaveBeenCalled();

    await store.touch('s1');
    expect(map.get('s1')?.accessCount).toBe(3);
  });
});
