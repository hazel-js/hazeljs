/**
 * Correlate platform AgentRun resources with durable runtime runs / timelines.
 * Does not copy checkpoints into the platform resource.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileAgentRunRepository } from '../run/file-agent-run.repository';
import { createDurableRunStore } from '../run/durable-run-store';
import { FileTimelineStore } from '../timeline/timeline.store';

export interface DurableRunSummary {
  found: boolean;
  runId: string;
  agentName?: string;
  status?: string;
  attempt?: number;
  checkpointId?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  /** Timeline step count for this executionId (if timeline configured). */
  timelineSteps?: number;
  /** Where the durable record was read from. */
  store?: string;
  note?: string;
}

export interface DurableRunLookup {
  lookup(runId: string): Promise<DurableRunSummary> | DurableRunSummary;
}

export interface FileDurableRunLookupOptions {
  /** Single-file runs store (default CLI: `.hazel/agent-runs.json`). */
  runsPath?: string;
  /** Durable store directory with runs.json (+ checkpoints). */
  durableDir?: string;
  /** JSONL timeline path for step counts. */
  timelinePath?: string;
}

export function createFileDurableRunLookup(
  options: FileDurableRunLookupOptions = {}
): DurableRunLookup {
  return {
    async lookup(runId: string): Promise<DurableRunSummary> {
      let storeLabel: string | undefined;
      let run: Awaited<ReturnType<FileAgentRunRepository['get']>> | undefined;

      if (options.durableDir) {
        const root = path.resolve(options.durableDir);
        if (fs.existsSync(root)) {
          const durable = createDurableRunStore(root);
          run = await durable.runRepository.get(runId);
          storeLabel = root;
        } else {
          storeLabel = root;
        }
      }

      if (!run && options.runsPath) {
        const runsPath = path.resolve(options.runsPath);
        storeLabel = storeLabel ?? runsPath;
        if (fs.existsSync(runsPath)) {
          const repo = new FileAgentRunRepository(runsPath);
          run = await repo.get(runId);
          storeLabel = runsPath;
        }
      }

      if (!run) {
        return {
          found: false,
          runId,
          store: storeLabel,
          note: 'No durable AgentRun found for this runId (platform resource does not store checkpoints)',
        };
      }

      let timelineSteps: number | undefined;
      if (options.timelinePath) {
        const timelinePath = path.resolve(options.timelinePath);
        if (fs.existsSync(timelinePath)) {
          timelineSteps = new FileTimelineStore(timelinePath).load({
            executionId: runId,
          }).length;
        }
      }

      return {
        found: true,
        runId: run.id,
        agentName: run.agentName,
        status: run.status,
        attempt: run.attempt,
        checkpointId: run.checkpointId,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        timelineSteps,
        store: storeLabel,
        note: 'Checkpoints remain in the durable AgentRun store, not this resource',
      };
    },
  };
}
