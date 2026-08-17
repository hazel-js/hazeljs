/**
 * Redis-backed ApprovalProvider for multi-instance Gatekeeper deployments.
 * Approvals created on replica A can be resolved and consumed on replica B.
 */

import type { ApprovalRequest, ApprovalStatus, Clock } from '../types';
import { safeClone } from '../security';
import type { ApprovalProvider } from './provider';

export interface RedisApprovalCommands {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface RedisApprovalProviderOptions {
  keyPrefix?: string;
  clock?: Clock;
  /** Fallback TTL when expiresAt is missing or in the past. Default 300s. */
  defaultTtlSeconds?: number;
}

interface StoredApproval extends Omit<ApprovalRequest, 'createdAt' | 'expiresAt'> {
  createdAt: string;
  expiresAt: string;
}

function serialize(request: ApprovalRequest): string {
  const stored: StoredApproval = {
    ...request,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
  };
  return JSON.stringify(stored);
}

function deserialize(raw: string): ApprovalRequest | undefined {
  try {
    const parsed = JSON.parse(raw) as StoredApproval;
    if (!parsed?.approvalId) return undefined;
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      expiresAt: new Date(parsed.expiresAt),
    };
  } catch {
    return undefined;
  }
}

function ttlSeconds(request: ApprovalRequest, clock: Clock, fallback: number): number {
  const remaining = Math.ceil((request.expiresAt.getTime() - clock.now().getTime()) / 1000);
  return Math.max(1, remaining || fallback);
}

/**
 * Shared approval store. Use this (or a durable IApprovalStore / HumanTaskService)
 * whenever more than one Node process may authorize the same agent run.
 */
export function createRedisApprovalProvider(
  redis: RedisApprovalCommands,
  options: RedisApprovalProviderOptions = {}
): ApprovalProvider {
  const prefix = options.keyPrefix ?? 'gatekeeper:approval:';
  const clock = options.clock ?? { now: (): Date => new Date() };
  const defaultTtlSeconds = options.defaultTtlSeconds ?? 300;

  const key = (id: string): string => `${prefix}${id}`;

  const read = async (approvalId: string): Promise<ApprovalRequest | undefined> => {
    const raw = await redis.get(key(approvalId));
    if (!raw) return undefined;
    const req = deserialize(raw);
    if (!req) return undefined;
    if (req.status === 'pending' && req.expiresAt < clock.now()) {
      req.status = 'expired';
      await redis.setEx(key(approvalId), defaultTtlSeconds, serialize(req));
    }
    return safeClone(req);
  };

  const write = async (request: ApprovalRequest): Promise<ApprovalRequest> => {
    const stored = safeClone(request);
    await redis.setEx(
      key(stored.approvalId),
      ttlSeconds(stored, clock, defaultTtlSeconds),
      serialize(stored)
    );
    return stored;
  };

  return {
    create: (request): Promise<ApprovalRequest> => write(request),
    get: (approvalId): Promise<ApprovalRequest | undefined> => read(approvalId),
    async resolve(
      approvalId: string,
      status: 'approved' | 'rejected',
      _resolvedBy?: string
    ): Promise<ApprovalRequest | undefined> {
      const req = await read(approvalId);
      if (!req) return undefined;
      if (req.status !== 'pending') return req;
      req.status = status;
      return write(req);
    },
    async consume(
      approvalId: string,
      fingerprint: string
    ): Promise<{ valid: boolean; request?: ApprovalRequest; reason?: string }> {
      const req = await read(approvalId);
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
      req.status = 'consumed' as ApprovalStatus;
      const stored = await write(req);
      return { valid: true, request: stored };
    },
  };
}
