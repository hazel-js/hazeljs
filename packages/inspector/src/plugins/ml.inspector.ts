/**
 * ML inspector plugin - inspects @Model and ModelRegistry
 * Optional: requires @hazeljs/ml to be installed
 */

import 'reflect-metadata';
import type {
  InspectorContext,
  InspectorEntry,
  MLModelInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetMLModule(): {
  hasModelMetadata: (t: object) => boolean;
  getModelMetadata: (t: object) => { name?: string; version?: string };
  ModelRegistry: new () => { list: () => Array<{ name?: string; version?: string }> };
} | null {
  try {
    return require('@hazeljs/ml');
  } catch {
    return null;
  }
}

export const mlInspector: HazelInspectorPlugin = {
  name: 'ml',
  version: '1.0.0',
  supports: () => tryGetMLModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const mlMod = tryGetMLModule();
    if (!mlMod) return [];

    const entries: MLModelInspectorEntry[] = [];
    const seen = new Set<string>();

    // From container tokens with @Model
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];
    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      if (!mlMod.hasModelMetadata(token as object)) continue;

      const meta = mlMod.getModelMetadata(token as object);
      const className = (token as { name?: string }).name ?? 'Unknown';
      const key = `${meta?.name ?? className}@${meta?.version ?? 'latest'}`;
      if (seen.has(key)) continue;
      seen.add(key);

      entries.push({
        id: createId('ml', meta?.name ?? className, meta?.version ?? ''),
        kind: 'ml',
        packageName: '@hazeljs/ml',
        sourceType: 'class',
        className,
        modelName: meta?.name ?? className,
        version: meta?.version,
      });
    }

    // From ModelRegistry if available
    try {
      const registry = context.container.resolve(mlMod.ModelRegistry);
      if (registry?.list) {
        const models = registry.list();
        for (const m of models) {
          const key = `${m.name}@${m.version ?? 'latest'}`;
          if (seen.has(key)) continue;
          seen.add(key);
          entries.push({
            id: createId('ml', m.name ?? 'unknown', m.version ?? ''),
            kind: 'ml',
            packageName: '@hazeljs/ml',
            modelName: m.name ?? 'unknown',
            version: m.version,
          });
        }
      }
    } catch {
      // ModelRegistry not in container
    }

    return entries;
  },
};
