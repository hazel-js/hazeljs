/**
 * Storage seam for Agent OS — file today, SQLite/Postgres later.
 */

import type { AgentRunRepository } from '../run/agent-run.repository';
import type { CheckpointService } from '../run/checkpoint.service';
import type { HumanTaskService } from '../run/human-task.service';
import {
  createDurableRunStore,
  createDurableRunStoreFromEnv,
  durableRunStoreBackendFromEnv,
  type DurableRunStore,
} from '../run/durable-run-store';
import { FileResourceRepository } from '../platform/repository';
import type { ResourceRepository } from '../platform/repository';
import { FilePlatformEventSink, type PlatformEventSink } from '../platform/events';
import { ensureHazelHome, hazelHome, type HazelHomePaths } from './paths';

export interface AgentOSStore {
  agents: ResourceRepository;
  runs: AgentRunRepository;
  checkpoints: CheckpointService;
  approvals: HumanTaskService;
  events: PlatformEventSink;
  durable: DurableRunStore;
  paths: HazelHomePaths;
}

export interface CreateAgentOSStoreOptions {
  home?: string;
  projectRoot?: string;
  platformStore?: string;
  durableDir?: string;
  eventsPath?: string;
  /** Prefer SQL when DATABASE_URL / AGENT_OS_DURABLE_BACKEND=sql. */
  preferSql?: boolean;
}

export function createAgentOSStore(options: CreateAgentOSStoreOptions = {}): AgentOSStore {
  const paths = ensureHazelHome(hazelHome(options.home));
  const platformStore = options.platformStore ?? paths.platformStore;
  const durableDir = options.durableDir ?? paths.runsDir;
  const eventsPath = options.eventsPath ?? paths.eventsPath;

  const useSql = options.preferSql !== false && durableRunStoreBackendFromEnv() === 'sql';
  const durable = useSql
    ? createDurableRunStoreFromEnv({ cwd: options.projectRoot ?? paths.home })
    : createDurableRunStore(durableDir);

  return {
    agents: new FileResourceRepository(platformStore),
    runs: durable.runRepository,
    checkpoints: durable.checkpointService,
    approvals: durable.humanTaskService,
    events: new FilePlatformEventSink(eventsPath),
    durable,
    paths,
  };
}
