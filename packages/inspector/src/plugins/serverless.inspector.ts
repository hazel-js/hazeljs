/**
 * Serverless inspector plugin - inspects @Serverless controllers
 * Optional: requires @hazeljs/serverless to be installed
 */

import 'reflect-metadata';
import type {
  InspectorEntry,
  ServerlessInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';
import { collectControllersFromModule } from '@hazeljs/core';

const _SERVERLESS_METADATA_KEY = 'hazel:serverless';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetServerlessModule(): {
  getServerlessMetadata: (
    t: object
  ) => { memory?: number; timeout?: number; runtime?: string } | undefined;
} | null {
  try {
    return require('@hazeljs/serverless');
  } catch {
    return null;
  }
}

export const serverlessInspector: HazelInspectorPlugin = {
  name: 'serverless',
  version: '1.0.0',
  supports: () => tryGetServerlessModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const slsMod = tryGetServerlessModule();
    if (!slsMod) return [];

    const entries: ServerlessInspectorEntry[] = [];
    const controllers = collectControllersFromModule(context.moduleType);

    for (const ctrl of controllers) {
      if (typeof ctrl !== 'function') continue;
      const meta = slsMod.getServerlessMetadata(ctrl as object);
      if (!meta) continue;

      const className = (ctrl as { name?: string }).name ?? 'Unknown';
      entries.push({
        id: createId('serverless', className),
        kind: 'serverless',
        packageName: '@hazeljs/serverless',
        sourceType: 'class',
        className,
        controllerName: className,
        runtime: meta.runtime,
        memory: meta.memory,
        timeout: meta.timeout,
      });
    }

    return entries;
  },
};
