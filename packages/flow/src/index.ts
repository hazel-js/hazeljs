/**
 * @hazeljs/flow - Durable execution graph engine
 * Default: in-memory (no DB). For DB persistence use createPrismaStorage(prisma) from '@hazeljs/flow/prisma'.
 */

import { FlowEngine } from './engine/FlowEngine.js';
export { FlowEngine };
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

/** Construct FlowEngine when `AGENT_OS_FLOW_PEER=1` (or a custom env flag). */
export function createFlowEngineFromEnv(options?: {
  env?: NodeJS.ProcessEnv;
  envVar?: string;
}): FlowEngine | undefined {
  const env = options?.env ?? process.env;
  const envVar = options?.envVar ?? 'AGENT_OS_FLOW_PEER';
  if (env[envVar] !== '1') return undefined;
  return new FlowEngine();
}
