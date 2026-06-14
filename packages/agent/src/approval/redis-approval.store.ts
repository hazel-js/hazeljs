import { ToolApprovalRequest } from '../types/tool.types';
import type { RedisClientLike } from '../state/redis-client.types';
import { IApprovalStore } from './approval-store.interface';
import { InMemoryApprovalStore } from './in-memory-approval.store';

export interface RedisApprovalStoreConfig {
  client: RedisClientLike;
  keyPrefix?: string;
  defaultTtlSeconds?: number;
}

/**
 * Redis-backed approval store for multi-instance deployments.
 * Local resolvers handle in-process waits; Redis holds durable request state.
 */
export class RedisApprovalStore implements IApprovalStore {
  private readonly client: RedisClientLike;
  private readonly keyPrefix: string;
  private readonly defaultTtlSeconds: number;
  private readonly local = new InMemoryApprovalStore();

  constructor(config: RedisApprovalStoreConfig) {
    if (!config.client) {
      throw new Error('Redis client is required for RedisApprovalStore');
    }
    this.client = config.client;
    this.keyPrefix = config.keyPrefix ?? 'agent:approval:';
    this.defaultTtlSeconds = config.defaultTtlSeconds ?? 300;
  }

  private key(requestId: string): string {
    return `${this.keyPrefix}${requestId}`;
  }

  async create(request: ToolApprovalRequest): Promise<void> {
    const expiresAt = request.expiresAt ?? new Date(Date.now() + this.defaultTtlSeconds * 1000);
    const ttl = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000) || this.defaultTtlSeconds
    );
    await this.client.setEx(this.key(request.requestId), ttl, JSON.stringify(request));
    this.local.create(request);
  }

  async get(requestId: string): Promise<ToolApprovalRequest | undefined> {
    const local = this.local.get(requestId);
    if (local) return local;
    const raw = await this.client.get(this.key(requestId));
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as ToolApprovalRequest;
      parsed.requestedAt = new Date(parsed.requestedAt);
      if (parsed.expiresAt) parsed.expiresAt = new Date(parsed.expiresAt);
      if (parsed.approvedAt) parsed.approvedAt = new Date(parsed.approvedAt);
      if (parsed.rejectedAt) parsed.rejectedAt = new Date(parsed.rejectedAt);
      return parsed;
    } catch {
      return undefined;
    }
  }

  async listPending(): Promise<ToolApprovalRequest[]> {
    const keys = await this.client.keys(`${this.keyPrefix}*`);
    const pending: ToolApprovalRequest[] = [];
    for (const redisKey of keys) {
      const raw = await this.client.get(redisKey);
      if (!raw) continue;
      try {
        const req = JSON.parse(raw) as ToolApprovalRequest;
        if (req.status === 'pending') {
          req.requestedAt = new Date(req.requestedAt);
          if (req.expiresAt) req.expiresAt = new Date(req.expiresAt);
          pending.push(req);
        }
      } catch {
        // skip corrupt entries
      }
    }
    return pending;
  }

  async approve(requestId: string, approvedBy: string): Promise<boolean> {
    const request = await this.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }
    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    const expiresAt = request.expiresAt ?? new Date(Date.now() + this.defaultTtlSeconds * 1000);
    const ttl = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    await this.client.setEx(this.key(requestId), ttl, JSON.stringify(request));
    return this.local.approve(requestId, approvedBy);
  }

  async reject(requestId: string): Promise<boolean> {
    const request = await this.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }
    request.status = 'rejected';
    request.rejectedAt = new Date();
    const rejectExpiresAt =
      request.expiresAt ?? new Date(Date.now() + this.defaultTtlSeconds * 1000);
    const rejectTtl = Math.max(1, Math.ceil((rejectExpiresAt.getTime() - Date.now()) / 1000));
    await this.client.setEx(this.key(requestId), rejectTtl, JSON.stringify(request));
    return this.local.reject(requestId);
  }

  async delete(requestId: string): Promise<void> {
    this.local.delete(requestId);
    await this.client.del(this.key(requestId));
  }

  /** Register local resolver for waiting execution on this instance. */
  registerResolver(
    requestId: string,
    resolver: { resolve: (approved: boolean) => void; timeoutId?: NodeJS.Timeout }
  ): void {
    this.local.registerResolver(requestId, resolver);
  }

  /** Poll Redis when approval happens on another instance. */
  async waitForResolution(
    requestId: string,
    expiresAt: Date,
    pollIntervalMs = 200
  ): Promise<boolean> {
    const deadline = expiresAt.getTime();
    while (Date.now() < deadline) {
      const req = await this.get(requestId);
      if (!req) return false;
      if (req.status === 'approved') return true;
      if (req.status === 'rejected' || req.status === 'expired') return false;
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    return false;
  }
}
