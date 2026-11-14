/**
 * Apply Agent DNA onto a registered @Agent instance (decorator / embedded apps).
 * Preserves @Tool handlers; merges PolicyEngine rules instead of replacing them.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseDna, type AgentDna } from './agent-dna';
import type { PolicyRule } from '../policies/policy.engine';
import { PolicyEngine } from '../policies/policy.engine';

export type DnaAppliedListener = (agentName: string, dna: AgentDna) => void;

export interface ResolveAgentDnaPathOptions {
  name: string;
  /** From `@Agent({ dna })` — true = convention path, string = explicit path. */
  dna: boolean | string;
  projectRoot?: string;
}

export interface ApplyAgentDnaTarget {
  getAgent(name: string):
    | {
        name: string;
        description?: string;
        systemPrompt?: string;
        model?: string;
        metadata?: Record<string, unknown>;
      }
    | undefined;
  patchAgent(
    name: string,
    patch: Partial<{
      description: string;
      systemPrompt: string;
      model: string;
      metadata: Record<string, unknown>;
    }>
  ): void;
  getPolicyEngine?(): PolicyEngine | undefined;
  setPolicyEngine?(engine: PolicyEngine): void;
}

export interface ApplyAgentDnaResult {
  agentName: string;
  dnaVersion: string;
  updated: string[];
  path: string;
}

/** Read a `.dna.json` (or marketplace-shaped) file and validate. */
export function loadDnaFile(filePath: string): AgentDna {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DNA file not found: ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (raw && typeof raw === 'object' && 'dna' in raw && (raw as { dna: unknown }).dna) {
    return parseDna((raw as { dna: AgentDna }).dna);
  }
  return parseDna(raw as AgentDna);
}

/**
 * Resolve DNA file path from `@Agent({ dna })`.
 * - `true` → `{projectRoot}/dna/{name}.dna.json`
 * - relative string → under projectRoot
 * - absolute string → as-is
 */
export function resolveAgentDnaPath(options: ResolveAgentDnaPathOptions): string {
  const root = options.projectRoot ?? process.cwd();
  if (options.dna === true) {
    return path.join(root, 'dna', `${options.name}.dna.json`);
  }
  if (typeof options.dna === 'string') {
    return path.isAbsolute(options.dna) ? options.dna : path.join(root, options.dna);
  }
  throw new Error('resolveAgentDnaPath: dna must be true or a string path');
}

/** PolicyEngine-shaped rules from DNA `policies[]` (legacy PolicyRule entries). */
export function policyRulesFromDna(dna: AgentDna): PolicyRule[] {
  const out: PolicyRule[] = [];
  for (const raw of dna.policies ?? []) {
    if (
      raw &&
      typeof raw === 'object' &&
      'id' in raw &&
      'effect' in raw &&
      'tool' in raw &&
      !('version' in raw && 'match' in raw)
    ) {
      out.push(raw as PolicyRule);
    }
  }
  return out;
}

/**
 * Apply DNA prompt/model/description and merge PolicyEngine rules.
 * Does **not** register dynamic tool stubs (handlers stay on the @Tool instance).
 */
export function applyAgentDna(
  target: ApplyAgentDnaTarget,
  dna: AgentDna,
  options?: { path?: string }
): ApplyAgentDnaResult {
  const agent = target.getAgent(dna.name);
  if (!agent) {
    throw new Error(`Cannot apply DNA: agent "${dna.name}" is not registered`);
  }

  const updated: string[] = [];
  const patch: Parameters<ApplyAgentDnaTarget['patchAgent']>[1] = {};

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
  patch.metadata = {
    ...(agent.metadata ?? {}),
    ...(dna.metadata ?? {}),
    dnaVersion: dna.version,
    dnaPath: options?.path,
  };
  updated.push('metadata');

  target.patchAgent(dna.name, patch);

  const dnaRules = policyRulesFromDna(dna);
  if (dnaRules.length && target.setPolicyEngine) {
    const engine = target.getPolicyEngine?.() ?? new PolicyEngine([]);
    const existing = engine.getRules();
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (const rule of dnaRules) {
      byId.set(rule.id, rule);
    }
    engine.setRules([...byId.values()]);
    target.setPolicyEngine(engine);
    updated.push('policies');
  }

  return {
    agentName: dna.name,
    dnaVersion: dna.version,
    updated,
    path: options?.path ?? '',
  };
}

/**
 * Load DNA from decorator config and apply onto a registered agent.
 */
export function loadAndApplyAgentDna(
  target: ApplyAgentDnaTarget,
  options: ResolveAgentDnaPathOptions
): { dna: AgentDna; result: ApplyAgentDnaResult } {
  const filePath = resolveAgentDnaPath(options);
  const dna = loadDnaFile(filePath);
  if (dna.name !== options.name) {
    throw new Error(
      `DNA name "${dna.name}" does not match agent "${options.name}" (file: ${filePath})`
    );
  }
  const result = applyAgentDna(target, dna, { path: filePath });
  return { dna, result };
}
