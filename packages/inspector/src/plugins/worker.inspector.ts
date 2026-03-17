/**
 * Worker inspector plugin - inspects @WorkerTask decorated classes
 * Optional: requires @hazeljs/worker to be installed
 */

import 'reflect-metadata';
import type {
  InspectorEntry,
  WorkerInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetWorkerModule(): {
  getWorkerTaskMetadata: (
    t: object
  ) => { name: string; timeout?: number; maxConcurrency?: number } | undefined;
  WorkerRegistry?: new () => {
    getAll: () => Array<{
      name: string;
      handlerPath: string;
      timeout?: number;
      maxConcurrency?: number;
    }>;
  };
} | null {
  try {
    return require('@hazeljs/worker');
  } catch {
    return null;
  }
}

export const workerInspector: HazelInspectorPlugin = {
  name: 'worker',
  version: '1.0.0',
  supports: (_context) => {
    return tryGetWorkerModule() !== null;
  },
  inspect: async (context): Promise<InspectorEntry[]> => {
    const workerMod = tryGetWorkerModule();
    if (!workerMod) return [];

    const entries: WorkerInspectorEntry[] = [];
    const container = context.container as {
      resolve?: (token: unknown) => unknown;
      getTokens?: () => unknown[];
    };

    try {
      const WorkerRegistry = workerMod.WorkerRegistry;
      if (WorkerRegistry && container.resolve) {
        const registry = container.resolve(WorkerRegistry) as {
          getAll?: () => Array<{
            name: string;
            handlerPath: string;
            timeout?: number;
            maxConcurrency?: number;
          }>;
        };
        if (registry && typeof registry.getAll === 'function') {
          const tasks = registry.getAll();
          for (const task of tasks) {
            entries.push({
              id: createId('worker', task.name),
              kind: 'worker',
              packageName: '@hazeljs/worker',
              sourceType: 'class',
              taskName: task.name,
              handlerPath: task.handlerPath,
              timeout: task.timeout,
              maxConcurrency: task.maxConcurrency,
            });
          }
          return entries;
        }
      }
    } catch {
      // WorkerRegistry not in container - try metadata discovery
    }

    const tokens = container.getTokens?.() ?? [];
    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const metadata = workerMod.getWorkerTaskMetadata(token.prototype ?? (token as object));
      if (!metadata?.name) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      entries.push({
        id: createId('worker', metadata.name),
        kind: 'worker',
        packageName: '@hazeljs/worker',
        sourceType: 'class',
        className,
        taskName: metadata.name,
        timeout: metadata.timeout,
        maxConcurrency: metadata.maxConcurrency,
      });
    }

    return entries;
  },
};
