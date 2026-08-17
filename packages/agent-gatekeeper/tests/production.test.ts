/**
 * Production adapters — shared audit and multi-instance approvals.
 */

import {
  createApprovalStoreProvider,
  createAuditTransportSink,
  createHumanTaskProvider,
  createOtelAuditSink,
  createRedisApprovalProvider,
  toHazelAuditEvent,
  type GatekeeperAuditEvent,
} from '../src/index';

function sampleEvent(overrides: Partial<GatekeeperAuditEvent> = {}): GatekeeperAuditEvent {
  return {
    type: 'gatekeeper.decision.allowed',
    timestamp: '2026-08-17T12:00:00.000Z',
    invocationId: 'inv-1',
    runId: 'run-1',
    agentId: 'refund-agent',
    tenantId: 'tenant-a',
    toolName: 'stripe.refund',
    environment: 'production',
    decision: 'allow',
    durationMs: 4,
    ...overrides,
  };
}

function memoryRedis() {
  const data = new Map<string, string>();
  return {
    data,
    async get(key: string): Promise<string | null> {
      return data.get(key) ?? null;
    },
    async setEx(key: string, _ttl: number, value: string): Promise<void> {
      data.set(key, value);
    },
    async del(key: string): Promise<number> {
      return data.delete(key) ? 1 : 0;
    },
  };
}

const approval = {
  approvalId: 'apr-1',
  invocationId: 'inv-1',
  runId: 'run-1',
  agentId: 'refund-agent',
  toolName: 'stripe.refund',
  argumentSummary: { amount: 80 },
  reason: 'amount > 50',
  policyIds: ['p1'],
  policyVersions: ['1'],
  createdAt: new Date('2026-08-17T12:00:00.000Z'),
  expiresAt: new Date('2026-08-17T12:05:00.000Z'),
  riskClassification: 'medium' as const,
  idempotencyKey: 'k',
  invocationFingerprint: 'fp-80',
  status: 'pending' as const,
};

describe('production audit sinks', () => {
  it('maps gatekeeper events onto the Hazel audit shape', () => {
    const mapped = toHazelAuditEvent(sampleEvent());
    expect(mapped.action).toBe('gatekeeper.decision.allowed');
    expect(mapped.result).toBe('success');
    expect(mapped.resource).toBe('stripe.refund');
    expect(mapped.resourceId).toBe('inv-1');
    expect(mapped.actor?.id).toBe('refund-agent');
    expect(mapped.metadata?.tenantId).toBeUndefined();
    expect(mapped.actor?.tenantId).toBe('tenant-a');
  });

  it('maps deny and approval-required outcomes', () => {
    expect(toHazelAuditEvent(sampleEvent({ type: 'gatekeeper.decision.denied' })).result).toBe(
      'denied'
    );
    expect(toHazelAuditEvent(sampleEvent({ type: 'gatekeeper.tool.failed' })).result).toBe(
      'denied'
    );
    expect(
      toHazelAuditEvent(sampleEvent({ type: 'gatekeeper.decision.approval_required' })).result
    ).toBe('failure');
  });

  it('awaits a shared transport so Kafka/file sinks fail closed', async () => {
    const log = jest.fn().mockResolvedValue(undefined);
    const sink = createAuditTransportSink({ log });
    await sink.emit(sampleEvent());
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'gatekeeper.decision.allowed', requestId: 'run-1' })
    );
  });

  it('propagates transport failures', async () => {
    const sink = createAuditTransportSink({
      log: () => Promise.reject(new Error('kafka down')),
    });
    await expect(sink.emit(sampleEvent())).rejects.toThrow('kafka down');
  });

  it('emits OpenTelemetry spans for the collector', () => {
    const span = {
      setAttribute: jest.fn(),
      addEvent: jest.fn(),
      end: jest.fn(),
    };
    const sink = createOtelAuditSink({
      trace: {
        getTracer: () => ({
          startSpan: () => span,
        }),
      },
    });
    sink.emit(
      sampleEvent({
        type: 'gatekeeper.decision.denied',
        denialCode: 'GATEKEEPER_DENIED',
        reason: 'cross-tenant',
      })
    );
    expect(span.setAttribute).toHaveBeenCalledWith('gatekeeper.tool', 'stripe.refund');
    expect(span.setAttribute).toHaveBeenCalledWith('gatekeeper.denial_code', 'GATEKEEPER_DENIED');
    expect(span.end).toHaveBeenCalled();
  });

  it('ends OTEL spans when addEvent is omitted', () => {
    const span = { setAttribute: jest.fn(), end: jest.fn() };
    const sink = createOtelAuditSink({
      trace: { getTracer: () => ({ startSpan: () => span }) },
    });
    sink.emit(sampleEvent());
    expect(span.end).toHaveBeenCalled();
  });
});

describe('createRedisApprovalProvider', () => {
  it('creates, resolves, and consumes across two replicas sharing Redis', async () => {
    const redis = memoryRedis();
    const replicaA = createRedisApprovalProvider(redis, {
      clock: { now: () => new Date('2026-08-17T12:01:00.000Z') },
    });
    const replicaB = createRedisApprovalProvider(redis, {
      clock: { now: () => new Date('2026-08-17T12:01:00.000Z') },
    });

    await replicaA.create(approval);
    expect((await replicaB.get('apr-1'))?.status).toBe('pending');

    await replicaB.resolve('apr-1', 'approved', 'ops-1');
    expect((await replicaA.get('apr-1'))?.status).toBe('approved');

    const consumed = await replicaA.consume('apr-1', 'fp-80');
    expect(consumed.valid).toBe(true);
    expect((await replicaB.consume('apr-1', 'fp-80')).reason).toBe('Approval already consumed');
  });

  it('rejects fingerprint mismatch, missing, expired, and rejected tokens', async () => {
    const redis = memoryRedis();
    const now = new Date('2026-08-17T12:01:00.000Z');
    const provider = createRedisApprovalProvider(redis, { clock: { now: () => now } });

    expect((await provider.consume('missing', 'fp')).reason).toBe('Approval not found');

    await provider.create(approval);
    expect((await provider.consume('apr-1', 'fp-80')).reason).toBe('Approval not granted');

    await provider.resolve('apr-1', 'approved');
    expect((await provider.consume('apr-1', 'wrong')).reason).toContain('fingerprint');

    const rejected = { ...approval, approvalId: 'apr-2' };
    await provider.create(rejected);
    await provider.resolve('apr-2', 'rejected');
    expect((await provider.consume('apr-2', 'fp-80')).reason).toBe('Approval rejected');

    const expired = {
      ...approval,
      approvalId: 'apr-3',
      expiresAt: new Date('2026-08-17T11:00:00.000Z'),
    };
    await provider.create(expired);
    expect((await provider.get('apr-3'))?.status).toBe('expired');
    expect((await provider.consume('apr-3', 'fp-80')).reason).toBe('Approval expired');
  });

  it('ignores corrupt Redis payloads', async () => {
    const redis = memoryRedis();
    await redis.setEx('gatekeeper:approval:bad', 30, '{not-json');
    const provider = createRedisApprovalProvider(redis);
    expect(await provider.get('bad')).toBeUndefined();
  });

  it('no-ops resolve when the approval is missing', async () => {
    const provider = createRedisApprovalProvider(memoryRedis());
    expect(await provider.resolve('nope', 'approved')).toBeUndefined();
  });
});

describe('durable store and HITL bridges', () => {
  const clock = { now: (): Date => new Date('2026-08-17T12:01:00.000Z') };

  it('lets a second replica consume an approval from IApprovalStore', async () => {
    const records = new Map<string, unknown>();
    const store = {
      create(r: { requestId: string }) {
        records.set(r.requestId, r);
      },
      get(id: string) {
        return records.get(id);
      },
      approve: () => true,
      reject: () => true,
    };
    const replicaA = createApprovalStoreProvider(store, clock);
    const replicaB = createApprovalStoreProvider(store, clock);
    await replicaA.create(approval);
    await replicaB.resolve('apr-1', 'approved', 'ops');
    expect((await replicaA.consume('apr-1', 'fp-80')).valid).toBe(true);
    expect((await replicaB.consume('apr-1', 'fp-80')).reason).toBe('Approval already consumed');
  });

  it('returns not found when store metadata is missing', async () => {
    const provider = createApprovalStoreProvider({
      create: () => undefined,
      get: () => ({ metadata: {} }),
      approve: () => true,
      reject: () => true,
    });
    expect(await provider.get('x')).toBeUndefined();
    expect((await provider.consume('x', 'fp')).reason).toBe('Approval not found');
  });

  it('consumes an approved human task from shared HITL state', async () => {
    const tasks = new Map<string, { id: string; status: string; payload?: unknown }>();
    const humanTasks = {
      async create(input: { id?: string; payload?: unknown }) {
        const id = input.id ?? 'ht';
        tasks.set(id, { id, status: 'pending', payload: input.payload });
        return { id };
      },
      async get(id: string) {
        return tasks.get(id);
      },
      async resolve(id: string, decision: string) {
        const task = tasks.get(id);
        if (task) task.status = decision;
        return task;
      },
    };
    const replicaA = createHumanTaskProvider(humanTasks, clock);
    const replicaB = createHumanTaskProvider(humanTasks, clock);
    await replicaA.create(approval);
    await replicaB.resolve('apr-1', 'approved');
    expect((await replicaB.consume('apr-1', 'fp-80')).valid).toBe(true);
    expect((await replicaA.get('apr-1'))?.status).toBe('approved');
  });

  it('skips human tasks without a gatekeeper payload', async () => {
    const provider = createHumanTaskProvider({
      create: async () => ({ id: 'x' }),
      get: async () => ({ status: 'pending', payload: {} }),
      resolve: async () => undefined,
    });
    expect(await provider.get('x')).toBeUndefined();
  });
});
