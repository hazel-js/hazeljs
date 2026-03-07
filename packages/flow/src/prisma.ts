/**
 * Prisma-backed storage for @hazeljs/flow.
 * Import from '@hazeljs/flow/prisma' when you want DB persistence.
 * Requires @prisma/client to be installed and the flow schema applied (migrations).
 */

export { createPrismaStorage } from './persistence/prismaStorage.js';
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
