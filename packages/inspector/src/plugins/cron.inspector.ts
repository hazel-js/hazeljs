/**
 * Cron inspector plugin - inspects @Cron decorated methods
 * Optional: requires @hazeljs/cron to be installed
 */

import 'reflect-metadata';
import type { InspectorEntry, CronInspectorEntry, HazelInspectorPlugin } from '../contracts/types';
function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function getNextRuns(cronExpression: string, count = 5): string[] {
  try {
    const parser = require('cron-parser');
    const interval = parser.parseExpression(cronExpression);
    const runs: string[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(interval.next().toDate().toISOString());
    }
    return runs;
  } catch {
    return [];
  }
}

function tryGetCronModule(): {
  getCronMetadata: (t: object) => Array<{
    methodName: string;
    options: { name?: string; cronTime?: string; enabled?: boolean };
  }>;
} | null {
  try {
    return require('@hazeljs/cron');
  } catch {
    return null;
  }
}

export const cronInspector: HazelInspectorPlugin = {
  name: 'cron',
  version: '1.0.0',
  supports: (_context) => {
    return tryGetCronModule() !== null;
  },
  inspect: async (_context): Promise<InspectorEntry[]> => {
    const cronMod = tryGetCronModule();
    if (!cronMod) return [];

    const entries: CronInspectorEntry[] = [];
    const tokensRaw = (_context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];
    const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const jobsRaw = cronMod.getCronMetadata(token.prototype ?? (token as object));
      const jobs = Array.isArray(jobsRaw) ? jobsRaw : [];
      if (!jobs.length) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      for (const job of jobs) {
        const opts = job.options || {};
        const nextRuns = opts.cronTime ? getNextRuns(opts.cronTime) : [];
        entries.push({
          id: createId('cron', opts.name ?? `${className}.${job.methodName}`),
          kind: 'cron',
          packageName: '@hazeljs/cron',
          sourceType: 'method',
          className,
          methodName: job.methodName,
          jobName: opts.name ?? `${className}.${job.methodName}`,
          cronExpression: opts.cronTime,
          enabled: opts.enabled !== false,
          nextRuns: nextRuns.length ? nextRuns : undefined,
        });
      }
    }

    return entries;
  },
};
