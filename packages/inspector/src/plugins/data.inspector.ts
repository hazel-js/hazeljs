/**
 * Data pipeline inspector plugin - inspects @Pipeline
 * Optional: requires @hazeljs/data to be installed
 */

import 'reflect-metadata';
import type {
  InspectorContext,
  InspectorEntry,
  DataPipelineInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';

const PIPELINE_METADATA_KEY = 'hazel:data:pipeline';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetDataModule(): { hasPipelineMetadata: (t: object) => boolean; getPipelineMetadata: (t: object) => { name?: string } | undefined } | null {
  try {
    return require('@hazeljs/data');
  } catch {
    return null;
  }
}

export const dataInspector: HazelInspectorPlugin = {
  name: 'data',
  version: '1.0.0',
  supports: () => tryGetDataModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const dataMod = tryGetDataModule();
    if (!dataMod) return [];

    const entries: DataPipelineInspectorEntry[] = [];
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      if (!dataMod.hasPipelineMetadata(token as object)) continue;

      const meta = dataMod.getPipelineMetadata(token as object);
      const className = (token as { name?: string }).name ?? 'Unknown';
      const pipelineName = meta?.name ?? className;

      entries.push({
        id: createId('data', pipelineName),
        kind: 'data',
        packageName: '@hazeljs/data',
        sourceType: 'class',
        className,
        pipelineName,
      });
    }

    return entries;
  },
};
