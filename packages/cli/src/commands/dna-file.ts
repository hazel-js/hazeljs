/**
 * Load DNA from a JSON/YAML file for `hazel apply`.
 * Supports bare DNA, `{ dna }`, or AgentDefinition (`spec.dna`).
 */

import * as fs from 'fs';
import * as path from 'path';

export async function loadDnaOrYaml(filePath: string): Promise<unknown> {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  if (abs.endsWith('.yaml') || abs.endsWith('.yml')) {
    const { parse } = await import('yaml');
    return parse(raw);
  }
  return JSON.parse(raw);
}

/**
 * Unwrap common DNA document shapes into the nested AgentDna object.
 */
export function extractDna(doc: unknown): unknown {
  if (!doc || typeof doc !== 'object') return doc;
  const o = doc as Record<string, unknown>;
  if (o.format === 'hazeljs.agent.dna') return o;
  if (o.dna && typeof o.dna === 'object') return o.dna;
  if (o.kind === 'AgentDefinition' && (o.spec as { dna?: unknown })?.dna) {
    return (o.spec as { dna: unknown }).dna;
  }
  if (o.name && (o.systemPrompt || o.mission || o.tools)) return o;
  return o;
}
