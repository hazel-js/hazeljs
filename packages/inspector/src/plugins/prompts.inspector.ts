/**
 * Prompts inspector plugin - inspects registered prompts in PromptRegistry
 * Optional: requires @hazeljs/prompts to be installed
 */

import type {
  InspectorEntry,
  PromptInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetPromptsModule(): { PromptRegistry: { list: () => string[] } } | null {
  try {
    return require('@hazeljs/prompts');
  } catch {
    return null;
  }
}

export const promptsInspector: HazelInspectorPlugin = {
  name: 'prompts',
  version: '1.0.0',
  supports: () => tryGetPromptsModule() !== null,
  inspect: async (): Promise<InspectorEntry[]> => {
    const promptsMod = tryGetPromptsModule();
    if (!promptsMod) return [];

    const keys = promptsMod.PromptRegistry.list();
    const entries: PromptInspectorEntry[] = keys.map((key) => {
      const parts = key.split(':');
      const scope = parts.length >= 2 ? parts[0] : undefined;
      return {
        id: createId('prompt', key),
        kind: 'prompt',
        packageName: '@hazeljs/prompts',
        promptKey: key,
        scope,
      };
    });

    return entries;
  },
};
