/**
 * Prisma-backed storage. Use when you want to persist flows in a database.
 * Import from '@hazeljs/flow/prisma' so Prisma is optional for the default package.
 */

import type { PrismaClient } from './prisma.js';
import type { FlowStorage } from './storage.js';
import { FlowDefinitionRepo } from './FlowDefinitionRepo.js';
import { FlowRunRepo } from './FlowRunRepo.js';
import { FlowEventRepo } from './FlowEventRepo.js';
import { IdempotencyRepo } from './IdempotencyRepo.js';
import { withAdvisoryLock } from '../engine/Locks.js';

/**
 * Create storage backed by Prisma (Postgres). Requires @prisma/client and the flow schema.
 */
export function createPrismaStorage(prisma: PrismaClient): FlowStorage {
  return {
    definitionRepo: new FlowDefinitionRepo(prisma),
    runRepo: new FlowRunRepo(prisma),
    eventRepo: new FlowEventRepo(prisma),
    idempotencyRepo: new IdempotencyRepo(prisma),
    withLock: (runId, fn) => withAdvisoryLock(prisma, runId, fn),
  };
}
