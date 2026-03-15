/**
 * Queue inspector plugin - inspects @Queue decorated methods
 * Optional: requires @hazeljs/queue to be installed
 */

import 'reflect-metadata';
import type { InspectorContext, InspectorEntry, QueueInspectorEntry, HazelInspectorPlugin } from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetQueueModule(): {
  getQueueProcessorMetadata: (t: object) => Array<{ queueName: string; methodName: string; options?: { name?: string } }>;
} | null {
  try {
    return require('@hazeljs/queue');
  } catch {
    return null;
  }
}

export const queueInspector: HazelInspectorPlugin = {
  name: 'queue',
  version: '1.0.0',
  supports: (context) => {
    return tryGetQueueModule() !== null;
  },
  inspect: async (context): Promise<InspectorEntry[]> => {
    const queueMod = tryGetQueueModule();
    if (!queueMod) return [];

    const entries: QueueInspectorEntry[] = [];
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const processors = queueMod.getQueueProcessorMetadata(token.prototype ?? (token as object));
      if (!processors?.length) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      for (const p of processors) {
        entries.push({
          id: createId('queue', p.queueName, className, p.methodName),
          kind: 'queue',
          packageName: '@hazeljs/queue',
          sourceType: 'method',
          className,
          methodName: p.methodName,
          queueName: p.queueName,
          consumerName: p.options?.name ?? `${className}.${p.methodName}`,
          jobName: p.methodName,
        });
      }
    }

    return entries;
  },
};
