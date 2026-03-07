/**
 * In-memory storage for flow engine (default, no DB required).
 */

import type { FlowDefinition } from '../types/FlowTypes.js';
import type { FlowRunStatus } from '../types/FlowTypes.js';
import {
  type FlowStorage,
  type FlowRunRow,
  type CreateRunInput,
  type IFlowDefinitionRepo,
  type IFlowRunRepo,
  type IFlowEventRepo,
  type IIdempotencyRepo,
  type IdempotencyRecord,
} from './storage.js';
import { toSerializable } from './serialize.js';

const RUNNING: FlowRunStatus = 'RUNNING';

function now(): Date {
  return new Date();
}

class MemoryFlowDefinitionRepo implements IFlowDefinitionRepo {
  private store = new Map<string, FlowDefinition>();

  key(flowId: string, version: string): string {
    return `${flowId}@${version}`;
  }

  async save(def: FlowDefinition): Promise<void> {
    this.store.set(this.key(def.flowId, def.version), { ...def });
  }

  async get(flowId: string, version: string): Promise<FlowDefinition | null> {
    return this.store.get(this.key(flowId, version)) ?? null;
  }

  async list(): Promise<Array<{ flowId: string; version: string; definitionJson: unknown }>> {
    const entries = Array.from(this.store.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([k, def]) => {
      const [flowId, version] = k.split('@');
      return {
        flowId,
        version,
        definitionJson: toSerializable(def) as unknown,
      };
    });
  }
}

class MemoryFlowRunRepo implements IFlowRunRepo {
  private runs = new Map<string, FlowRunRow>();

  async create(input: CreateRunInput): Promise<FlowRunRow> {
    const now_ = now();
    const row: FlowRunRow = {
      runId: input.runId,
      flowId: input.flowId,
      flowVersion: input.flowVersion,
      tenantId: input.tenantId ?? null,
      status: RUNNING,
      currentNodeId: null,
      inputJson: input.input,
      stateJson: input.initialState ?? {},
      outputsJson: {},
      createdAt: now_,
      updatedAt: now_,
    };
    this.runs.set(input.runId, row);
    return row;
  }

  async get(runId: string): Promise<FlowRunRow | null> {
    return this.runs.get(runId) ?? null;
  }

  async update(runId: string, data: Partial<FlowRunRow>): Promise<FlowRunRow> {
    const existing = this.runs.get(runId);
    if (!existing) throw new Error(`Run not found: ${runId}`);
    const updated: FlowRunRow = {
      ...existing,
      ...data,
      updatedAt: now(),
    };
    this.runs.set(runId, updated);
    return updated;
  }

  async findRunning(): Promise<FlowRunRow[]> {
    return Array.from(this.runs.values()).filter((r) => r.status === 'RUNNING');
  }
}

class MemoryFlowEventRepo implements IFlowEventRepo {
  private events: Array<{
    id: string;
    runId: string;
    at: Date;
    type: string;
    nodeId: string | null;
    attempt: number | null;
    payloadJson: unknown;
  }> = [];
  private id = 0;

  async append(runId: string, type: string, payload: Record<string, unknown> = {}): Promise<void> {
    this.events.push({
      id: `evt-${++this.id}`,
      runId,
      at: now(),
      type,
      nodeId: (payload.nodeId as string) ?? null,
      attempt: (payload.attempt as number) ?? null,
      payloadJson: payload,
    });
  }

  async getTimeline(runId: string): Promise<
    Array<{
      at: Date;
      type: string;
      nodeId: string | null;
      attempt: number | null;
      payloadJson: unknown;
    }>
  > {
    return this.events
      .filter((e) => e.runId === runId)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((e) => ({
        at: e.at,
        type: e.type,
        nodeId: e.nodeId,
        attempt: e.attempt,
        payloadJson: e.payloadJson,
      }));
  }
}

class MemoryIdempotencyRepo implements IIdempotencyRepo {
  private store = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    return this.store.get(key) ?? null;
  }

  async set(
    key: string,
    runId: string,
    nodeId: string,
    outputJson?: unknown,
    patchJson?: unknown
  ): Promise<void> {
    this.store.set(key, {
      key,
      runId,
      nodeId,
      outputJson: outputJson ?? null,
      patchJson: patchJson ?? null,
    });
  }
}

const memoryLockQueues = new Map<string, Promise<unknown>>();

/** In-memory mutex per runId */
function memoryWithLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const prev = memoryLockQueues.get(runId) ?? Promise.resolve();
  let resolveNext: () => void;
  const _next = new Promise<void>((r) => {
    resolveNext = r;
  });
  const chain = prev.then(
    (): Promise<T> =>
      (async (): Promise<T> => {
        try {
          return await fn();
        } finally {
          resolveNext!();
        }
      })()
  );
  memoryLockQueues.set(runId, chain);
  return chain as Promise<T>;
}

/**
 * Create in-memory storage (default, no database).
 */
export function createMemoryStorage(): FlowStorage {
  return {
    definitionRepo: new MemoryFlowDefinitionRepo(),
    runRepo: new MemoryFlowRunRepo(),
    eventRepo: new MemoryFlowEventRepo(),
    idempotencyRepo: new MemoryIdempotencyRepo(),
    withLock: memoryWithLock,
  };
}
