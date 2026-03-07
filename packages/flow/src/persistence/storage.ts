/**
 * Storage interfaces for flow engine.
 * Default implementation is in-memory; Prisma can be injected via createPrismaStorage (see @hazeljs/flow/prisma).
 */

import type { FlowDefinition } from '../types/FlowTypes.js';
import type { FlowRunStatus } from '../types/FlowTypes.js';
import type { FlowEventType, FlowRunEventPayload } from '../types/Events.js';

export type { FlowRunStatus };

export interface FlowRunRow {
  runId: string;
  flowId: string;
  flowVersion: string;
  tenantId: string | null;
  status: FlowRunStatus;
  currentNodeId: string | null;
  inputJson: unknown;
  stateJson: unknown;
  outputsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRunInput {
  runId: string;
  flowId: string;
  flowVersion: string;
  tenantId?: string | null;
  input: unknown;
  initialState?: Record<string, unknown>;
}

export interface IFlowDefinitionRepo {
  save(def: FlowDefinition): Promise<void>;
  get(flowId: string, version: string): Promise<FlowDefinition | null>;
  list(): Promise<Array<{ flowId: string; version: string; definitionJson: unknown }>>;
}

export interface IFlowRunRepo {
  create(input: CreateRunInput): Promise<FlowRunRow>;
  get(runId: string): Promise<FlowRunRow | null>;
  update(runId: string, data: Partial<FlowRunRow>): Promise<FlowRunRow>;
  findRunning(): Promise<FlowRunRow[]>;
}

export interface IFlowEventRepo {
  append(runId: string, type: FlowEventType, payload?: FlowRunEventPayload): Promise<void>;
  getTimeline(runId: string): Promise<
    Array<{
      at: Date;
      type: string;
      nodeId: string | null;
      attempt: number | null;
      payloadJson: unknown;
    }>
  >;
}

export interface IdempotencyRecord {
  key: string;
  runId: string;
  nodeId: string;
  outputJson: unknown;
  patchJson: unknown;
}

export interface IIdempotencyRepo {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(
    key: string,
    runId: string,
    nodeId: string,
    outputJson?: unknown,
    patchJson?: unknown
  ): Promise<void>;
}

/** Run-scoped lock: only one tick/resume per runId at a time */
export type WithLockFn = <T>(runId: string, fn: () => Promise<T>) => Promise<T>;

export interface FlowStorage {
  definitionRepo: IFlowDefinitionRepo;
  runRepo: IFlowRunRepo;
  eventRepo: IFlowEventRepo;
  idempotencyRepo: IIdempotencyRepo;
  withLock: WithLockFn;
}
