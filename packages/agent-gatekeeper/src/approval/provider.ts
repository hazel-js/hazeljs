/**
 * Approval provider interface and in-memory implementation.
 */

import type { ApprovalRequest, ApprovalStatus, Clock, IdGenerator, ToolRiskLevel } from '../types';
import { invocationFingerprint, redactObject, safeClone } from '../security';

export interface ApprovalProvider {
  create(request: ApprovalRequest): Promise<ApprovalRequest>;
  get(approvalId: string): Promise<ApprovalRequest | undefined>;
  resolve(
    approvalId: string,
    status: 'approved' | 'rejected',
    resolvedBy?: string
  ): Promise<ApprovalRequest | undefined>;
  consume(
    approvalId: string,
    fingerprint: string
  ): Promise<{ valid: boolean; request?: ApprovalRequest; reason?: string }>;
}

export interface InMemoryApprovalProviderOptions {
  clock?: Clock;
  idGenerator?: IdGenerator;
  defaultTtlMs?: number;
}

export class InMemoryApprovalProvider implements ApprovalProvider {
  private readonly store = new Map<string, ApprovalRequest>();
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly defaultTtlMs: number;

  constructor(options: InMemoryApprovalProviderOptions = {}) {
    this.clock = options.clock ?? { now: (): Date => new Date() };
    this.idGenerator = options.idGenerator ?? ((): string => `apr-${Date.now()}`);
    this.defaultTtlMs = options.defaultTtlMs ?? 300_000;
  }

  async create(request: ApprovalRequest): Promise<ApprovalRequest> {
    const stored = safeClone(request);
    this.store.set(stored.approvalId, stored);
    return stored;
  }

  async get(approvalId: string): Promise<ApprovalRequest | undefined> {
    const req = this.store.get(approvalId);
    if (!req) return undefined;
    if (req.expiresAt < this.clock.now() && req.status === 'pending') {
      req.status = 'expired';
    }
    return safeClone(req);
  }

  async resolve(
    approvalId: string,
    status: 'approved' | 'rejected',
    _resolvedBy?: string
  ): Promise<ApprovalRequest | undefined> {
    const req = this.store.get(approvalId);
    if (!req) return undefined;
    if (req.status !== 'pending') return safeClone(req);
    req.status = status;
    return safeClone(req);
  }

  async consume(
    approvalId: string,
    fingerprint: string
  ): Promise<{ valid: boolean; request?: ApprovalRequest; reason?: string }> {
    const req = this.store.get(approvalId);
    if (!req) return { valid: false, reason: 'Approval not found' };
    if (req.expiresAt < this.clock.now()) {
      req.status = 'expired';
      return { valid: false, reason: 'Approval expired' };
    }
    if (req.status === 'rejected') return { valid: false, reason: 'Approval rejected' };
    if (req.status === 'consumed') return { valid: false, reason: 'Approval already consumed' };
    if (req.status !== 'approved') return { valid: false, reason: 'Approval not granted' };
    if (req.invocationFingerprint !== fingerprint) {
      return { valid: false, reason: 'Approval fingerprint mismatch — arguments changed' };
    }
    req.status = 'consumed';
    return { valid: true, request: safeClone(req) };
  }
}

export interface BuildApprovalRequestInput {
  invocationId: string;
  runId: string;
  agentId: string;
  agentVersion?: string;
  tenantId?: string;
  delegatedUserId?: string;
  toolName: string;
  input: Record<string, unknown>;
  reason: string;
  policyIds: string[];
  policyVersions: string[];
  riskClassification: ToolRiskLevel;
  idempotencyKey: string;
  redactFields?: string[];
  ttlMs?: number;
}

export function buildApprovalRequest(
  input: BuildApprovalRequestInput,
  clock: Clock,
  idGenerator: IdGenerator,
  defaultTtlMs: number
): ApprovalRequest {
  const now = clock.now();
  const fingerprint = invocationFingerprint({
    agentId: input.agentId,
    toolName: input.toolName,
    input: input.input,
    tenantId: input.tenantId,
  });
  return {
    approvalId: idGenerator(),
    invocationId: input.invocationId,
    runId: input.runId,
    agentId: input.agentId,
    agentVersion: input.agentVersion,
    tenantId: input.tenantId,
    delegatedUserId: input.delegatedUserId,
    toolName: input.toolName,
    argumentSummary: redactObject(input.input, input.redactFields ?? []),
    reason: input.reason,
    policyIds: input.policyIds,
    policyVersions: input.policyVersions,
    createdAt: now,
    expiresAt: new Date(now.getTime() + (input.ttlMs ?? defaultTtlMs)),
    riskClassification: input.riskClassification,
    idempotencyKey: input.idempotencyKey,
    invocationFingerprint: fingerprint,
    status: 'pending',
  };
}

const GATEKEEPER_REQUEST_KEY = 'gatekeeperRequest';

interface SerializedApprovalRequest extends Omit<ApprovalRequest, 'createdAt' | 'expiresAt'> {
  createdAt: string;
  expiresAt: string;
}

function serializeApproval(request: ApprovalRequest): SerializedApprovalRequest {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
  };
}

function deserializeApproval(raw: unknown): ApprovalRequest | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const parsed = raw as Partial<SerializedApprovalRequest>;
  if (typeof parsed.approvalId !== 'string' || typeof parsed.invocationFingerprint !== 'string') {
    return undefined;
  }
  return {
    ...(parsed as SerializedApprovalRequest),
    createdAt: new Date(parsed.createdAt ?? Date.now()),
    expiresAt: new Date(parsed.expiresAt ?? Date.now()),
  };
}

function applyExpiry(request: ApprovalRequest, clock: Clock): ApprovalRequest {
  if (request.status === 'pending' && request.expiresAt < clock.now()) {
    return { ...request, status: 'expired' };
  }
  return request;
}

/**
 * Durable bridge to @hazeljs/agent IApprovalStore (RedisApprovalStore, SQL, …).
 * The full Gatekeeper approval record is stored in `metadata.gatekeeperRequest`
 * so get/consume work on any replica — not only the process that created it.
 */
export function createApprovalStoreProvider(
  store: {
    create(request: unknown): Promise<void> | void;
    get(requestId: string): Promise<unknown> | unknown;
    approve(requestId: string, approvedBy: string): Promise<boolean> | boolean;
    reject(requestId: string): Promise<boolean> | boolean;
  },
  clock: Clock = { now: () => new Date() }
): ApprovalProvider {
  const toStoreRecord = (request: ApprovalRequest): Record<string, unknown> => ({
    requestId: request.approvalId,
    executionId: request.invocationId,
    toolName: request.toolName,
    agentId: request.agentId,
    input: request.argumentSummary,
    reason: request.reason,
    requestedAt: request.createdAt,
    expiresAt: request.expiresAt,
    status: request.status === 'consumed' ? 'approved' : request.status,
    metadata: { [GATEKEEPER_REQUEST_KEY]: serializeApproval(request) },
  });

  const persist = async (request: ApprovalRequest): Promise<ApprovalRequest> => {
    const stored = safeClone(request);
    await store.create(toStoreRecord(stored));
    return stored;
  };

  const load = async (approvalId: string): Promise<ApprovalRequest | undefined> => {
    const raw = await store.get(approvalId);
    if (!raw || typeof raw !== 'object') return undefined;
    const record = raw as { metadata?: Record<string, unknown> };
    const fromMeta = deserializeApproval(record.metadata?.[GATEKEEPER_REQUEST_KEY]);
    if (!fromMeta) return undefined;
    const expired = applyExpiry(fromMeta, clock);
    if (expired.status !== fromMeta.status) {
      await persist(expired);
    }
    return safeClone(expired);
  };

  return {
    create: (request): Promise<ApprovalRequest> => persist(request),
    get: (id): Promise<ApprovalRequest | undefined> => load(id),
    async resolve(
      id: string,
      status: 'approved' | 'rejected',
      resolvedBy?: string
    ): Promise<ApprovalRequest | undefined> {
      const current = await load(id);
      if (status === 'approved') {
        await store.approve(id, resolvedBy ?? 'gatekeeper');
      } else {
        await store.reject(id);
      }
      if (!current) return undefined;
      if (current.status !== 'pending') return current;
      current.status = status;
      return persist(current);
    },
    async consume(
      id: string,
      fingerprint: string
    ): Promise<{ valid: boolean; request?: ApprovalRequest; reason?: string }> {
      const req = await load(id);
      if (!req) return { valid: false, reason: 'Approval not found' };
      if (req.status === 'expired' || req.expiresAt < clock.now()) {
        return { valid: false, reason: 'Approval expired' };
      }
      if (req.status === 'rejected') return { valid: false, reason: 'Approval rejected' };
      if (req.status === 'consumed') return { valid: false, reason: 'Approval already consumed' };
      if (req.status !== 'approved') return { valid: false, reason: 'Approval not granted' };
      if (req.invocationFingerprint !== fingerprint) {
        return { valid: false, reason: 'Approval fingerprint mismatch — arguments changed' };
      }
      req.status = 'consumed';
      const stored = await persist(req);
      return { valid: true, request: stored };
    },
  };
}

/**
 * Durable bridge to @hazeljs/agent HumanTaskService (file/SQL HITL).
 * The Gatekeeper record lives in `payload.gatekeeperRequest` so another replica
 * can get/resolve after the creating process is gone.
 *
 * Consume is validated from the shared task record. For atomic consume across
 * replicas, use `createRedisApprovalProvider`.
 */
export function createHumanTaskProvider(
  humanTasks: {
    create(input: {
      id?: string;
      runId: string;
      type: 'tool_approval' | 'user_input' | 'review';
      toolName?: string;
      payload?: unknown;
      metadata?: unknown;
    }): Promise<{ id: string }>;
    get(id: string): Promise<
      | {
          status?: string;
          payload?: unknown;
          metadata?: unknown;
        }
      | undefined
    >;
    resolve(
      id: string,
      decision: 'approved' | 'rejected' | 'expired',
      resolvedBy?: string
    ): Promise<unknown>;
  },
  clock: Clock = { now: () => new Date() }
): ApprovalProvider {
  const load = async (approvalId: string): Promise<ApprovalRequest | undefined> => {
    const task = await humanTasks.get(approvalId);
    if (!task) return undefined;
    const payload =
      task.payload && typeof task.payload === 'object'
        ? (task.payload as Record<string, unknown>)
        : {};
    const fromPayload = deserializeApproval(payload[GATEKEEPER_REQUEST_KEY]);
    if (!fromPayload) return undefined;
    const mapped: ApprovalRequest = applyExpiry(fromPayload, clock);
    if (task.status === 'approved' && mapped.status === 'pending') mapped.status = 'approved';
    if (task.status === 'rejected') mapped.status = 'rejected';
    if (task.status === 'expired') mapped.status = 'expired';
    return safeClone(mapped);
  };

  return {
    async create(request): Promise<ApprovalRequest> {
      const stored = safeClone(request);
      await humanTasks.create({
        id: stored.approvalId,
        runId: stored.runId,
        type: 'tool_approval',
        toolName: stored.toolName,
        payload: {
          argumentSummary: stored.argumentSummary,
          reason: stored.reason,
          [GATEKEEPER_REQUEST_KEY]: serializeApproval(stored),
        },
        metadata: {
          policyIds: stored.policyIds,
          fingerprint: stored.invocationFingerprint,
        },
      });
      return stored;
    },
    get: (id): Promise<ApprovalRequest | undefined> => load(id),
    async resolve(
      id: string,
      status: 'approved' | 'rejected',
      resolvedBy?: string
    ): Promise<ApprovalRequest | undefined> {
      await humanTasks.resolve(id, status, resolvedBy);
      return load(id);
    },
    async consume(
      id: string,
      fingerprint: string
    ): Promise<{ valid: boolean; request?: ApprovalRequest; reason?: string }> {
      const req = await load(id);
      if (!req) return { valid: false, reason: 'Approval not found' };
      if (req.status === 'expired' || req.expiresAt < clock.now()) {
        return { valid: false, reason: 'Approval expired' };
      }
      if (req.status === 'rejected') return { valid: false, reason: 'Approval rejected' };
      if (req.status === 'consumed') return { valid: false, reason: 'Approval already consumed' };
      if (req.status !== 'approved') return { valid: false, reason: 'Approval not granted' };
      if (req.invocationFingerprint !== fingerprint) {
        return { valid: false, reason: 'Approval fingerprint mismatch — arguments changed' };
      }
      req.status = 'consumed';
      return { valid: true, request: safeClone(req) };
    },
  };
}

export type { ApprovalStatus };
