/**
 * Load DNA from a JSON/YAML file for `hazel apply`.
 * Supports bare DNA, `{ dna }`, or AgentDefinition (`spec.dna`).
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

const DNA_FILE_RE = /\.(ya?ml|json)$/i;

export async function loadDnaOrYaml(filePath: string): Promise<unknown> {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  if (abs.endsWith('.yaml') || abs.endsWith('.yml')) {
    return parseYaml(raw);
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

/** True when a parsed document is agent DNA / AgentDefinition (not package.json, etc.). */
export function isAgentDnaDocument(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const o = doc as Record<string, unknown>;
  if (o.kind === 'AgentDefinition') return true;
  if (o.format === 'hazeljs.agent.dna') return true;
  if (o.dna && typeof o.dna === 'object') {
    const inner = o.dna as Record<string, unknown>;
    return inner.format === 'hazeljs.agent.dna' || typeof inner.name === 'string';
  }
  return false;
}

function tryParseDnaFile(abs: string): unknown | undefined {
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    if (abs.endsWith('.yaml') || abs.endsWith('.yml')) return parseYaml(raw);
    if (abs.endsWith('.json')) return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * List top-level DNA / AgentDefinition files in a directory (for `hazel apply --all`).
 * Returns absolute paths, sorted (agent.yaml / agent.yml first, then alpha).
 */
export function listProjectDnaFiles(dir: string = process.cwd()): string[] {
  const root = path.resolve(dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];

  const files = fs
    .readdirSync(root)
    .filter((name) => DNA_FILE_RE.test(name))
    .map((name) => path.join(root, name))
    .filter((abs) => fs.statSync(abs).isFile())
    .filter((abs) => isAgentDnaDocument(tryParseDnaFile(abs)));

  const rank = (p: string): number => {
    const base = path.basename(p).toLowerCase();
    if (base === 'agent.yaml' || base === 'agent.yml') return 0;
    return 1;
  };

  return files.sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return path.basename(a).localeCompare(path.basename(b));
  });
}
