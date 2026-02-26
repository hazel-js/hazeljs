/**
 * @hazeljs/flow - Durable execution graph engine
 * Self-contained, independent of Hazel core
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
} from './types/FlowTypes.js';

export {
  createFlowPrismaClient,
  getFlowPrismaClient,
  resetFlowPrismaClient,
} from './persistence/prismaClient.js';

export { FlowDefinitionRepo } from './persistence/FlowDefinitionRepo.js';
export { FlowRunRepo } from './persistence/FlowRunRepo.js';
export type { FlowRunRow } from './persistence/FlowRunRepo.js';
export { FlowEventRepo } from './persistence/FlowEventRepo.js';
export { IdempotencyRepo } from './persistence/IdempotencyRepo.js';

export { runIdToLockKey, withAdvisoryLock } from './engine/Locks.js';

export {
  FlowError,
  LockBusyError,
  AmbiguousEdgeError,
  FlowNotFoundError,
  RunNotFoundError,
} from './types/Errors.js';
