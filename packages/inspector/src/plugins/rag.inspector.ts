/**
 * RAG inspector plugin - inspects @RAG and RAG-related modules
 * Optional: requires @hazeljs/rag to be installed
 */

import 'reflect-metadata';
import type { InspectorEntry, RagInspectorEntry, HazelInspectorPlugin } from '../contracts/types';
import { collectModulesFromModule } from '@hazeljs/core';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetRagModule(): {
  getRAGConfig: (
    t: object
  ) => { vectorDB?: string; embeddingModel?: string; chunkSize?: number } | undefined;
} | null {
  try {
    return require('@hazeljs/rag');
  } catch {
    return null;
  }
}

export const ragInspector: HazelInspectorPlugin = {
  name: 'rag',
  version: '1.0.0',
  supports: () => tryGetRagModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const ragMod = tryGetRagModule();
    if (!ragMod) return [];

    const entries: RagInspectorEntry[] = [];
    const modules = collectModulesFromModule(context.moduleType);

    for (const { moduleType: modRef, name } of modules) {
      const modType = (modRef as { module?: unknown }).module ?? modRef;
      const config = ragMod.getRAGConfig(modType as object);
      if (!config) continue;

      entries.push({
        id: createId('rag', name),
        kind: 'rag',
        packageName: '@hazeljs/rag',
        sourceType: 'class',
        pipelineName: name,
        vectorStore: config.vectorDB,
        embeddingProvider: config.embeddingModel,
        chunkingStrategy: config.chunkSize ? `${config.chunkSize} chars` : undefined,
      });
    }

    // Also check container for RAGService or similar
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];
    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const config = ragMod.getRAGConfig(token as object);
      if (!config) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      if (entries.some((e) => e.id === createId('rag', className))) continue;

      entries.push({
        id: createId('rag', className),
        kind: 'rag',
        packageName: '@hazeljs/rag',
        sourceType: 'class',
        className,
        pipelineName: className,
        vectorStore: config.vectorDB,
        embeddingProvider: config.embeddingModel,
        chunkingStrategy: config.chunkSize ? `${config.chunkSize} chars` : undefined,
      });
    }

    return entries;
  },
};
