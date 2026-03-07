/**
 * @hazeljs/flow - Durable execution graph engine
 * Default: in-memory (no DB). For DB persistence use createPrismaStorage(prisma) from '@hazeljs/flow/prisma'.
 */

export { FlowEngine } from './engine/FlowEngine.js';
export type { FlowEngineOptions, StartRunArgs, StartRunResult } from './engine/FlowEngine.js';

export { flow } from './dsl/flow.js';
export { Flow, Entry, Node, Edge, buildFlowDefinition } from './decorators/flow.decorators.js';
export type { NodeDecoratorOptions } from './decorators/flow.decorators.js';
export type {
  FlowDefinition,
  NodeDefinition,
  EdgeDefinition,
  FlowContext,
  NodeResult,
  RetryPolicy,
  FlowRunStatus,
} from './types/FlowTypes.js';

export { createMemoryStorage } from './persistence/memory.js';
export type {
  FlowStorage,
  FlowRunRow,
  CreateRunInput,
  IFlowDefinitionRepo,
  IFlowRunRepo,
  IFlowEventRepo,
  IIdempotencyRepo,
  IdempotencyRecord,
  WithLockFn,
} from './persistence/storage.js';

export {
  FlowError,
  LockBusyError,
  AmbiguousEdgeError,
  FlowNotFoundError,
  RunNotFoundError,
} from './types/Errors.js';
