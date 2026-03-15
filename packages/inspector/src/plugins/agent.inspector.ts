/**
 * Agent inspector plugin - inspects @Agent decorated classes and their tools
 * Optional: requires @hazeljs/agent to be installed
 */

import 'reflect-metadata';
import type {
  InspectorContext,
  InspectorEntry,
  AgentInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetAgentModule(): {
  isAgent: (t: new (...args: unknown[]) => unknown) => boolean;
  getAgentMetadata: (t: new (...args: unknown[]) => unknown) => { name?: string; model?: string; tools?: string[] };
  getAgentTools: (t: new (...args: unknown[]) => unknown) => string[];
} | null {
  try {
    return require('@hazeljs/agent');
  } catch {
    return null;
  }
}

export const agentInspector: HazelInspectorPlugin = {
  name: 'agent',
  version: '1.0.0',
  supports: () => tryGetAgentModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const agentMod = tryGetAgentModule();
    if (!agentMod) return [];

    const entries: AgentInspectorEntry[] = [];
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      if (!agentMod.isAgent(token as new (...args: unknown[]) => unknown)) continue;

      const meta = agentMod.getAgentMetadata(token as new (...args: unknown[]) => unknown);
      const tools = agentMod.getAgentTools(token as new (...args: unknown[]) => unknown);
      const className = (token as { name?: string }).name ?? 'Unknown';

      entries.push({
        id: createId('agent', meta?.name ?? className),
        kind: 'agent',
        packageName: '@hazeljs/agent',
        sourceType: 'class',
        className,
        agentName: meta?.name ?? className,
        tools: tools.length > 0 ? tools : undefined,
        model: meta?.model,
      });
    }

    return entries;
  },
};
