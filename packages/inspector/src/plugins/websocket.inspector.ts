/**
 * WebSocket inspector plugin - inspects @Realtime gateways and @Subscribe handlers
 * Optional: requires @hazeljs/websocket to be installed
 */

import 'reflect-metadata';
import type {
  InspectorEntry,
  WebSocketInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetWebSocketModule(): {
  getRealtimeMetadata: (t: object) => { path?: string; namespace?: string } | undefined;
  getSubscribeMetadata: (t: object, key: string | symbol) => string | undefined;
  isRealtimeGateway: (t: object) => boolean;
} | null {
  try {
    return require('@hazeljs/websocket');
  } catch {
    return null;
  }
}

export const websocketInspector: HazelInspectorPlugin = {
  name: 'websocket',
  version: '1.0.0',
  supports: (_context) => {
    return tryGetWebSocketModule() !== null;
  },
  inspect: async (_context): Promise<InspectorEntry[]> => {
    const wsMod = tryGetWebSocketModule();
    if (!wsMod) return [];

    const entries: WebSocketInspectorEntry[] = [];
    const tokens = (_context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      if (!wsMod.isRealtimeGateway(token)) continue;

      const meta = wsMod.getRealtimeMetadata(token);
      const className = (token as { name?: string }).name ?? 'Unknown';

      const gatewayEntry: WebSocketInspectorEntry = {
        id: createId('websocket', className),
        kind: 'websocket',
        packageName: '@hazeljs/websocket',
        sourceType: 'class',
        className,
        gatewayName: className,
        namespace: meta?.namespace ?? meta?.path ?? '/',
      };
      entries.push(gatewayEntry);

      // Scan for @Subscribe handlers
      const proto = token.prototype;
      if (proto) {
        const methods = Object.getOwnPropertyNames(proto).filter(
          (n) => n !== 'constructor' && typeof proto[n] === 'function'
        );
        for (const methodName of methods) {
          const event = wsMod.getSubscribeMetadata(proto, methodName);
          if (event) {
            entries.push({
              id: createId('websocket', className, methodName, event),
              kind: 'websocket',
              packageName: '@hazeljs/websocket',
              sourceType: 'method',
              className,
              methodName,
              gatewayName: className,
              namespace: meta?.namespace ?? meta?.path ?? '/',
              eventName: event,
            } as WebSocketInspectorEntry);
          }
        }
      }
    }

    return entries;
  },
};
