/**
 * Wire durable AgentRun + checkpoint + human-task + A2A stores
 * (AOS-006 / AOS-009 / AOS-014).
 */

import * as path from 'path';
import { FileAgentRunRepository } from './file-agent-run.repository';
import { FileCheckpointService } from './file-checkpoint.service';
import { FileHumanTaskService } from './file-human-task.service';
import { FileA2ATaskStore } from '../a2a/a2a-task.store';
import { SqlA2ATaskStore } from '../a2a/sql-a2a-task.store';
import { SqlAgentRunRepository } from './sql-agent-run.repository';
import { SqlCheckpointService } from './sql-checkpoint.service';
import { SqlHumanTaskService } from './sql-human-task.service';
import type { AgentRunRepository } from './agent-run.repository';
import type { CheckpointService } from './checkpoint.service';
import type { HumanTaskService } from './human-task.service';
import type { A2ATaskStore } from '../a2a/a2a-task.store';
import type { PrismaAgentRunClientLike } from './sql-run-client.types';

export type DurableRunStoreBackend = 'file' | 'sql';

export interface DurableRunStore {
  runRepository: AgentRunRepository;
  checkpointService: CheckpointService;
  humanTaskService: HumanTaskService;
  a2aTaskStore: A2ATaskStore;
  /** Filesystem root for file backend; `sql://prisma` for SQL backend. */
  dir: string;
  backend: DurableRunStoreBackend;
}

/**
 * Create file-backed run / checkpoint / human-task / A2A stores under `dir`.
 */
export function createDurableRunStore(dir: string): DurableRunStore {
  const root = path.resolve(dir);
  return {
    dir: root,
    backend: 'file',
    runRepository: new FileAgentRunRepository(path.join(root, 'runs.json')),
    checkpointService: new FileCheckpointService(path.join(root, 'checkpoints.json')),
    humanTaskService: new FileHumanTaskService(path.join(root, 'human-tasks.json')),
    a2aTaskStore: new FileA2ATaskStore(path.join(root, 'a2a-tasks.json')),
  };
}

/**
 * Create SQL-backed durable stores via Prisma (AOS-014).
 * Provider-agnostic — any Prisma SQL datasource (PostgreSQL, MySQL, SQLite, SQL Server, …).
 * Copy Agent OS models from `prisma-schema.example.prisma` into your schema, migrate, generate.
 */
export function createSqlDurableRunStore(client: PrismaAgentRunClientLike): DurableRunStore {
  return {
    dir: 'sql://prisma',
    backend: 'sql',
    runRepository: new SqlAgentRunRepository(client),
    checkpointService: new SqlCheckpointService(client),
    humanTaskService: new SqlHumanTaskService(client),
    a2aTaskStore: new SqlA2ATaskStore(client),
  };
}

export interface CreateDurableRunStoreFromEnvOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  prismaClient?: PrismaAgentRunClientLike;
  /** Override Prisma loading (tests). Default: `new (require('@prisma/client').PrismaClient)()`. */
  loadPrismaClient?: () => PrismaAgentRunClientLike;
}

export function durableRunStoreBackendFromEnv(
  env: NodeJS.ProcessEnv = process.env
): DurableRunStoreBackend {
  const raw = (env.AGENT_OS_DURABLE_BACKEND ?? 'file').trim().toLowerCase();
  return raw === 'sql' ? 'sql' : 'file';
}

/**
 * File store under `AGENT_OS_DURABLE_DIR` (default `.hazel/runs`), or SQL when
 * `AGENT_OS_DURABLE_BACKEND=sql`.
 */
export function createDurableRunStoreFromEnv(
  options: CreateDurableRunStoreFromEnvOptions = {}
): DurableRunStore {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  if (durableRunStoreBackendFromEnv(env) === 'sql') {
    const client =
      options.prismaClient ?? options.loadPrismaClient?.() ?? loadDefaultPrismaClient();
    return createSqlDurableRunStore(client);
  }

  const dir = env.AGENT_OS_DURABLE_DIR?.trim() || path.join(cwd, '.hazel', 'runs');
  return createDurableRunStore(dir);
}

function loadDefaultPrismaClient(): PrismaAgentRunClientLike {
  // Lazy so file-backend apps never need a generated Prisma client.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client') as {
    PrismaClient: new () => PrismaAgentRunClientLike;
  };
  return new PrismaClient();
}
