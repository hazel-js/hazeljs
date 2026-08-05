/**
 * AgentRun worker leases (Gamma) — fencing for multi-worker claim / reclaim.
 */

import { randomUUID } from 'crypto';
import { AgentRun, AgentRunStatus } from './agent-run.types';
import { isTerminalRunStatus } from './agent-run.transitions';
import type { AgentRunRepository } from './agent-run.repository';

export interface AgentRunLease {
  runId: string;
  owner: string;
  token: string;
  expiresAt: Date;
}

export interface TryAcquireLeaseResult {
  acquired: boolean;
  lease?: AgentRunLease;
  reason?: 'not_found' | 'held' | 'terminal';
  run?: AgentRun;
}

export interface AgentRunLeaseService {
  tryAcquire(runId: string, owner: string, ttlMs?: number): Promise<TryAcquireLeaseResult>;
  heartbeat(runId: string, owner: string, token: string, ttlMs?: number): Promise<boolean>;
  release(runId: string, owner: string, token: string): Promise<boolean>;
  /** Clear expired leases; RUNNING zombies → SUSPENDED for safe resume. */
  reclaimExpired(now?: Date): Promise<AgentRun[]>;
  listExpired(now?: Date): Promise<AgentRun[]>;
}

export interface RepositoryAgentRunLeaseOptions {
  /** Default lease TTL in ms (default 30s). */
  defaultTtlMs?: number;
  /**
   * When reclaiming an expired RUNNING lease, transition to SUSPENDED (default true).
   */
  suspendOnReclaim?: boolean;
}

function isLeaseActive(run: AgentRun, now: Date): boolean {
  if (!run.leaseOwner || !run.leaseExpiresAt) return false;
  return run.leaseExpiresAt.getTime() > now.getTime();
}

export class RepositoryAgentRunLeaseService implements AgentRunLeaseService {
  private readonly defaultTtlMs: number;
  private readonly suspendOnReclaim: boolean;

  constructor(
    private readonly repository: AgentRunRepository,
    options: RepositoryAgentRunLeaseOptions = {}
  ) {
    this.defaultTtlMs = options.defaultTtlMs ?? 30_000;
    this.suspendOnReclaim = options.suspendOnReclaim !== false;
  }

  async tryAcquire(
    runId: string,
    owner: string,
    ttlMs = this.defaultTtlMs
  ): Promise<TryAcquireLeaseResult> {
    const run = await this.repository.get(runId);
    if (!run) return { acquired: false, reason: 'not_found' };
    if (isTerminalRunStatus(run.status)) return { acquired: false, reason: 'terminal', run };

    const now = new Date();
    if (isLeaseActive(run, now) && run.leaseOwner !== owner) {
      return { acquired: false, reason: 'held', run };
    }

    const token = randomUUID();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const updated = await this.repository.updateStatus(runId, run.status, {
      leaseOwner: owner,
      leaseToken: token,
      leaseExpiresAt: expiresAt,
    });
    return {
      acquired: true,
      lease: { runId, owner, token, expiresAt },
      run: updated,
    };
  }

  async heartbeat(
    runId: string,
    owner: string,
    token: string,
    ttlMs = this.defaultTtlMs
  ): Promise<boolean> {
    const run = await this.repository.get(runId);
    if (!run) return false;
    if (run.leaseOwner !== owner || run.leaseToken !== token) return false;
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.repository.updateStatus(runId, run.status, {
      leaseOwner: owner,
      leaseToken: token,
      leaseExpiresAt: expiresAt,
    });
    return true;
  }

  async release(runId: string, owner: string, token: string): Promise<boolean> {
    const run = await this.repository.get(runId);
    if (!run) return false;
    if (run.leaseOwner !== owner || run.leaseToken !== token) return false;
    await this.repository.updateStatus(runId, run.status, {
      leaseOwner: undefined,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
    });
    return true;
  }

  async listExpired(now = new Date()): Promise<AgentRun[]> {
    const all = await this.repository.list();
    return all.filter(
      (r) =>
        !isTerminalRunStatus(r.status) &&
        r.leaseOwner &&
        r.leaseExpiresAt &&
        r.leaseExpiresAt.getTime() <= now.getTime()
    );
  }

  async reclaimExpired(now = new Date()): Promise<AgentRun[]> {
    const expired = await this.listExpired(now);
    const reclaimed: AgentRun[] = [];
    for (const run of expired) {
      const nextStatus =
        this.suspendOnReclaim && run.status === AgentRunStatus.RUNNING
          ? AgentRunStatus.SUSPENDED
          : run.status;
      const updated = await this.repository.updateStatus(run.id, nextStatus, {
        leaseOwner: undefined,
        leaseToken: undefined,
        leaseExpiresAt: undefined,
        metadata: {
          leaseReclaimedAt: now.toISOString(),
          leaseReclaimedFrom: run.leaseOwner,
        },
      });
      reclaimed.push(updated);
    }
    return reclaimed;
  }
}
