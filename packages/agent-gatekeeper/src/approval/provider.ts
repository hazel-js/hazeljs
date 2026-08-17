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

/** Bridge to @hazeljs/agent IApprovalStore when agent peer is available. */
export function createApprovalStoreProvider(
  store: {
    create(request: unknown): Promise<void> | void;
    get(requestId: string): Promise<unknown> | unknown;
    approve(requestId: string, approvedBy: string): Promise<boolean> | boolean;
    reject(requestId: string): Promise<boolean> | boolean;
  },
  clock: Clock = { now: () => new Date() }
): ApprovalProvider {
  const memory = new InMemoryApprovalProvider({ clock });
  return {
    async create(request): Promise<ApprovalRequest> {
      await store.create({
        requestId: request.approvalId,
        executionId: request.invocationId,
        toolName: request.toolName,
        agentId: request.agentId,
        input: request.argumentSummary,
        reason: request.reason,
        requestedAt: request.createdAt,
        expiresAt: request.expiresAt,
        status: 'pending',
        metadata: {
          policyIds: request.policyIds,
          fingerprint: request.invocationFingerprint,
        },
      });
      return memory.create(request);
    },
    get: (id): Promise<ApprovalRequest | undefined> => memory.get(id),
    resolve: (id, status, resolvedBy): Promise<ApprovalRequest | undefined> => {
      if (status === 'approved') {
        void store.approve(id, resolvedBy ?? 'gatekeeper');
      } else {
        void store.reject(id);
      }
      return memory.resolve(id, status, resolvedBy);
    },
    consume: (id, fingerprint): ReturnType<ApprovalProvider['consume']> =>
      memory.consume(id, fingerprint),
  };
}

/** Bridge to @hazeljs/agent HumanTaskService for durable HITL resume. */
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
    get(id: string): Promise<{ status?: string } | undefined>;
    resolve(
      id: string,
      decision: 'approved' | 'rejected' | 'expired',
      resolvedBy?: string
    ): Promise<unknown>;
  },
  clock: Clock = { now: () => new Date() }
): ApprovalProvider {
  const memory = new InMemoryApprovalProvider({ clock });
  return {
    async create(request): Promise<ApprovalRequest> {
      await humanTasks.create({
        id: request.approvalId,
        runId: request.runId,
        type: 'tool_approval',
        toolName: request.toolName,
        payload: {
          argumentSummary: request.argumentSummary,
          reason: request.reason,
        },
        metadata: {
          policyIds: request.policyIds,
          fingerprint: request.invocationFingerprint,
        },
      });
      return memory.create(request);
    },
    get: (id): Promise<ApprovalRequest | undefined> => memory.get(id),
    resolve: async (id, status, resolvedBy): Promise<ApprovalRequest | undefined> => {
      await humanTasks.resolve(id, status, resolvedBy);
      return memory.resolve(id, status, resolvedBy);
    },
    consume: (id, fingerprint): ReturnType<ApprovalProvider['consume']> =>
      memory.consume(id, fingerprint),
  };
}

export type { ApprovalStatus };
