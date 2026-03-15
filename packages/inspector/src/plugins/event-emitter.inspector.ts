/**
 * Event emitter inspector plugin - inspects @OnEvent listeners
 * Optional: requires @hazeljs/event-emitter to be installed
 */

import 'reflect-metadata';
import type { InspectorEntry, EventInspectorEntry, HazelInspectorPlugin } from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetEventEmitterModule(): {
  getOnEventMetadata: (
    t: object
  ) => Array<{ event: string | symbol | string[]; methodName: string }>;
} | null {
  try {
    return require('@hazeljs/event-emitter');
  } catch {
    return null;
  }
}

export const eventEmitterInspector: HazelInspectorPlugin = {
  name: 'event-emitter',
  version: '1.0.0',
  supports: () => tryGetEventEmitterModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const eeMod = tryGetEventEmitterModule();
    if (!eeMod) return [];

    const entries: EventInspectorEntry[] = [];
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const target = (token as new (...args: unknown[]) => object).prototype ?? token;
      const listeners = eeMod.getOnEventMetadata(target as object);
      if (!listeners?.length) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      for (const l of listeners) {
        const eventStr = Array.isArray(l.event) ? l.event.join(', ') : String(l.event);
        entries.push({
          id: createId('event', className, l.methodName, eventStr),
          kind: 'event',
          packageName: '@hazeljs/event-emitter',
          sourceType: 'method',
          className,
          methodName: l.methodName,
          eventName: eventStr,
        });
      }
    }

    return entries;
  },
};
