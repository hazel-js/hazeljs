/**
 * Live DNA hot-reload — apply .dna onto a running AgentRuntime registry.
 */

import type { AgentDna, AgentDnaTool } from './agent-dna';
import { parseDna } from './agent-dna';
import type { PolicyRule } from '../policies/policy.engine';
import { PolicyEngine } from '../policies/policy.engine';

export interface HotReloadTarget {
  getAgent(name: string):
    | {
        name: string;
        description?: string;
        systemPrompt?: string;
        model?: string;
        metadata?: Record<string, unknown>;
      }
    | undefined;
  /** Upsert agent metadata fields in place */
  patchAgent(
    name: string,
    patch: Partial<{
      description: string;
      systemPrompt: string;
      model: string;
      metadata: Record<string, unknown>;
    }>
  ): void;
  setPolicyEngine?(engine: PolicyEngine): void;
  getPolicyEngine?(): PolicyEngine | undefined;
  registerDynamicTool?(
    agentName: string,
    tool: AgentDnaTool & { handler?: (input: Record<string, unknown>) => Promise<unknown> }
  ): void;
}

export interface HotReloadResult {
  agentName: string;
  updated: string[];
  dnaVersion: string;
}

export function hotReloadAgentDna(
  target: HotReloadTarget,
  raw: string | AgentDna
): HotReloadResult {
  const dna = parseDna(raw);
  const agent = target.getAgent(dna.name);
  if (!agent) {
    throw new Error(`Cannot hot-reload: agent "${dna.name}" is not registered`);
  }

  const updated: string[] = [];
  const patch: Parameters<HotReloadTarget['patchAgent']>[1] = {};

  if (dna.systemPrompt != null && dna.systemPrompt !== agent.systemPrompt) {
    patch.systemPrompt = dna.systemPrompt;
    updated.push('systemPrompt');
  }
  if (dna.description != null && dna.description !== agent.description) {
    patch.description = dna.description;
    updated.push('description');
  }
  if (dna.model != null && dna.model !== agent.model) {
    patch.model = dna.model;
    updated.push('model');
  }
  if (dna.metadata) {
    patch.metadata = { ...(agent.metadata ?? {}), ...dna.metadata, dnaVersion: dna.version };
    updated.push('metadata');
  }

  if (Object.keys(patch).length) {
    target.patchAgent(dna.name, patch);
  }

  if (dna.policies && Array.isArray(dna.policies) && target.setPolicyEngine) {
    const rules = dna.policies as PolicyRule[];
    const engine = target.getPolicyEngine?.() ?? new PolicyEngine();
    engine.setRules(rules);
    target.setPolicyEngine(engine);
    updated.push('policies');
  }

  if (dna.tools?.length && target.registerDynamicTool) {
    for (const tool of dna.tools) {
      target.registerDynamicTool(dna.name, tool);
    }
    updated.push('tools');
  }

  return { agentName: dna.name, updated, dnaVersion: dna.version };
}
