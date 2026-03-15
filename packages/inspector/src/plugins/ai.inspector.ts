/**
 * AI inspector plugin - inspects @AIFunction decorated methods
 * Optional: requires @hazeljs/ai to be installed
 */

import 'reflect-metadata';
import type {
  InspectorContext,
  InspectorEntry,
  AIFunctionInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';
import { collectControllersFromModule } from '@hazeljs/core';

const AI_FUNCTION_METADATA_KEY = 'hazel:ai:function';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetAIModule(): boolean {
  try {
    require.resolve('@hazeljs/ai');
    return true;
  } catch {
    return false;
  }
}

export const aiInspector: HazelInspectorPlugin = {
  name: 'ai',
  version: '1.0.0',
  supports: () => tryGetAIModule(),
  inspect: async (context): Promise<InspectorEntry[]> => {
    if (!tryGetAIModule()) return [];

    const entries: AIFunctionInspectorEntry[] = [];
    const controllers = collectControllersFromModule(context.moduleType);

    for (const ctrl of controllers) {
      const proto = (ctrl as new (...args: unknown[]) => unknown).prototype;
      if (!proto) continue;

      const methodNames = Object.getOwnPropertyNames(proto).filter(
        (n) => n !== 'constructor' && typeof proto[n] === 'function'
      );

      for (const methodName of methodNames) {
        const meta = Reflect.getMetadata(AI_FUNCTION_METADATA_KEY, proto, methodName);
        if (!meta) continue;

        const className = (ctrl as { name?: string }).name ?? 'Unknown';
        entries.push({
          id: createId('aifunction', className, methodName),
          kind: 'aifunction',
          packageName: '@hazeljs/ai',
          sourceType: 'method',
          className,
          methodName,
          provider: meta.provider,
          model: meta.model,
          streaming: meta.streaming,
        });
      }
    }

    // Also scan providers for AI functions
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];
    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const proto = (token as new (...args: unknown[]) => unknown).prototype;
      if (!proto) continue;

      const methodNames = Object.getOwnPropertyNames(proto).filter(
        (n) => n !== 'constructor' && typeof proto[n] === 'function'
      );

      for (const methodName of methodNames) {
        const meta = Reflect.getMetadata(AI_FUNCTION_METADATA_KEY, proto, methodName);
        if (!meta) continue;

        const className = (token as { name?: string }).name ?? 'Unknown';
        const id = createId('aifunction', className, methodName);
        if (entries.some((e) => e.id === id)) continue;

        entries.push({
          id,
          kind: 'aifunction',
          packageName: '@hazeljs/ai',
          sourceType: 'method',
          className,
          methodName,
          provider: meta.provider,
          model: meta.model,
          streaming: meta.streaming,
        });
      }
    }

    return entries;
  },
};
