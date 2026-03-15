/**
 * Flow inspector plugin - inspects @Flow definitions with @Node
 * Optional: requires @hazeljs/flow to be installed
 */

import 'reflect-metadata';
import type { InspectorEntry, FlowInspectorEntry, HazelInspectorPlugin } from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

const FLOW_METADATA_KEY = 'flow:definition';
const NODE_METADATA_KEY = 'flow:nodes';
const EDGE_METADATA_KEY = 'flow:edges';
const ENTRY_METADATA_KEY = 'flow:entry';

function tryGetFlowModule(): boolean {
  try {
    require.resolve('@hazeljs/flow');
    return true;
  } catch {
    return false;
  }
}

export const flowInspector: HazelInspectorPlugin = {
  name: 'flow',
  version: '1.0.0',
  supports: () => tryGetFlowModule(),
  inspect: async (context): Promise<InspectorEntry[]> => {
    if (!tryGetFlowModule()) return [];

    const entries: FlowInspectorEntry[] = [];
    const tokensRaw = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];
    const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const flowMeta = Reflect.getMetadata(FLOW_METADATA_KEY, token);
      if (!flowMeta) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      const flowId = flowMeta.flowId ?? className;
      const version = flowMeta.version;

      const proto = (token as new (...args: unknown[]) => object).prototype;
      let entryNodeId: string | null = null;
      const allEdges: string[] = [];
      const nodeIds: string[] = [];

      if (proto) {
        const methodNames = Object.getOwnPropertyNames(proto).filter(
          (n) => n !== 'constructor' && typeof proto[n] === 'function'
        );
        for (const methodName of methodNames) {
          const nodeMeta = Reflect.getMetadata(NODE_METADATA_KEY, proto, methodName);
          if (nodeMeta) {
            const nodeId = nodeMeta.id ?? methodName;
            nodeIds.push(nodeId);
            if (Reflect.getMetadata(ENTRY_METADATA_KEY, proto, methodName)) {
              entryNodeId = nodeId;
            }
            const nodeEdgesRaw = Reflect.getMetadata(EDGE_METADATA_KEY, proto, methodName);
            const nodeEdges = Array.isArray(nodeEdgesRaw) ? nodeEdgesRaw : [];
            for (const e of nodeEdges) {
              allEdges.push(`${e.from}→${e.to}`);
            }
          }
        }
      }

      // Flow definition entry (one per @Flow class)
      entries.push({
        id: createId('flow', flowId, version ?? ''),
        kind: 'flow',
        packageName: '@hazeljs/flow',
        sourceType: 'class',
        className,
        flowId,
        version,
        nodeName: entryNodeId ?? undefined,
        entryNode: entryNodeId ?? undefined,
        nodes: nodeIds.join(', '),
        edges: allEdges.join('; ') || undefined,
      });

      // Node entries (one per @Node method)
      if (proto) {
        const methodNames = Object.getOwnPropertyNames(proto).filter(
          (n) => n !== 'constructor' && typeof proto[n] === 'function'
        );
        for (const methodName of methodNames) {
          const nodeMeta = Reflect.getMetadata(NODE_METADATA_KEY, proto, methodName);
          if (nodeMeta) {
            const nodeId = nodeMeta.id ?? methodName;
            const nodeEdgesRaw = Reflect.getMetadata(EDGE_METADATA_KEY, proto, methodName);
            const nodeEdges = Array.isArray(nodeEdgesRaw) ? nodeEdgesRaw : [];
            const edgesStr = nodeEdges
              .map((e: { from: string; to: string }) => `${e.from}→${e.to}`)
              .join(', ');
            const isEntry = Reflect.getMetadata(ENTRY_METADATA_KEY, proto, methodName);

            entries.push({
              id: createId('flow', flowId, 'node', nodeId),
              kind: 'flow',
              packageName: '@hazeljs/flow',
              sourceType: 'method',
              className,
              methodName,
              flowId,
              version,
              nodeName: nodeId,
              entryNode: isEntry ? nodeId : undefined,
              edges: edgesStr || undefined,
            });
          }
        }
      }
    }

    return entries;
  },
};
