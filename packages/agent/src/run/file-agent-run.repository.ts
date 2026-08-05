/**
 * File-backed AgentRun repository (AOS-014 light) — durable local process store for CLI / single-node.
 * For SQL, use SqlAgentRunRepository / createSqlDurableRunStore (any Prisma SQL provider).
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentRun, AgentRunStatus, AgentRunTransitionError } from './agent-run.types';
import { assertAgentRunTransition } from './agent-run.transitions';
import type { AgentRunRepository, CreateAgentRunInput } from './agent-run.repository';

interface StoredRun {
  id: string;
  agentName: string;
  agentVersion?: string;
  status: AgentRunStatus;
  input?: unknown;
  output?: unknown;
  error?: AgentRun['error'];
  tenantId?: string;
  userId?: string;
  parentRunId?: string;
  rootRunId: string;
  attempt: number;
  checkpointId?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  leaseToken?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

function toStored(run: AgentRun): StoredRun {
  return {
    ...run,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    leaseExpiresAt: run.leaseExpiresAt?.toISOString(),
  };
}

function fromStored(row: StoredRun): AgentRun {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
    completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
    updatedAt: new Date(row.updatedAt),
    leaseExpiresAt: row.leaseExpiresAt ? new Date(row.leaseExpiresAt) : undefined,
  };
}

export class FileAgentRunRepository implements AgentRunRepository {
  constructor(private readonly filePath: string) {}

  private readAll(): Map<string, AgentRun> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return new Map();
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) return new Map();
      const rows = JSON.parse(raw) as StoredRun[];
      const map = new Map<string, AgentRun>();
      for (const row of rows) {
        map.set(row.id, fromStored(row));
      }
      return map;
    } catch {
      return new Map();
    }
  }

  private writeAll(runs: Map<string, AgentRun>): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const rows = Array.from(runs.values()).map(toStored);
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const runs = this.readAll();
    if (runs.has(input.id)) {
      throw new Error(`AgentRun already exists: ${input.id}`);
    }
    const now = new Date();
    const run: AgentRun = {
      id: input.id,
      agentName: input.agentName,
      agentVersion: input.agentVersion,
      status: AgentRunStatus.CREATED,
      input: input.input,
      tenantId: input.tenantId,
      userId: input.userId,
      parentRunId: input.parentRunId,
      rootRunId: input.rootRunId ?? input.id,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };
    runs.set(run.id, run);
    this.writeAll(runs);
    return { ...run };
  }

  async get(runId: string): Promise<AgentRun | undefined> {
    const run = this.readAll().get(runId);
    return run ? { ...run } : undefined;
  }

  async updateStatus(
    runId: string,
    status: AgentRunStatus,
    patch?: Partial<
      Pick<
        AgentRun,
        | 'output'
        | 'error'
        | 'checkpointId'
        | 'metadata'
        | 'attempt'
        | 'leaseOwner'
        | 'leaseExpiresAt'
        | 'leaseToken'
      >
    >
  ): Promise<AgentRun> {
    const runs = this.readAll();
    const run = runs.get(runId);
    if (!run) {
      throw new Error(`AgentRun not found: ${runId}`);
    }
    assertAgentRunTransition(runId, run.status, status);
    run.status = status;
    run.updatedAt = new Date();
    if (status === AgentRunStatus.RUNNING && !run.startedAt) {
      run.startedAt = run.updatedAt;
    }
    if (
      status === AgentRunStatus.COMPLETED ||
      status === AgentRunStatus.FAILED ||
      status === AgentRunStatus.CANCELLED ||
      status === AgentRunStatus.TIMED_OUT
    ) {
      run.completedAt = run.updatedAt;
    }
    if (patch?.output !== undefined) run.output = patch.output;
    if (patch?.error !== undefined) run.error = patch.error;
    if (patch?.checkpointId !== undefined) run.checkpointId = patch.checkpointId;
    if (patch?.attempt !== undefined) run.attempt = patch.attempt;
    if (patch?.metadata) run.metadata = { ...run.metadata, ...patch.metadata };
    if (patch && 'leaseOwner' in patch) run.leaseOwner = patch.leaseOwner;
    if (patch && 'leaseExpiresAt' in patch) run.leaseExpiresAt = patch.leaseExpiresAt;
    if (patch && 'leaseToken' in patch) run.leaseToken = patch.leaseToken;
    runs.set(runId, run);
    this.writeAll(runs);
    return { ...run };
  }

  async list(filter?: { agentName?: string; status?: AgentRunStatus }): Promise<AgentRun[]> {
    let rows = Array.from(this.readAll().values());
    if (filter?.agentName) rows = rows.filter((r) => r.agentName === filter.agentName);
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    return rows.map((r) => ({ ...r }));
  }
}

export { AgentRunTransitionError };
