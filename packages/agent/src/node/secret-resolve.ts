/**
 * Resolve DNA secret refs inside hazeld only — never print values.
 */

import type { AgentDna } from '../dna/agent-dna';
import type { SecretStore } from './secrets';

export type DnaEnvValue = string | { secret: string };

let activeSecrets: Record<string, string> = {};

/** Read a secret resolved for the current agent start (daemon-only). */
export function getDaemonSecret(name: string): string | undefined {
  return activeSecrets[name] ?? process.env[name];
}

/** Activate resolved secrets for the duration of a run; returns restore fn. */
export function activateSecrets(env: Record<string, string>): () => void {
  const prev = activeSecrets;
  activeSecrets = { ...prev, ...env };
  return () => {
    activeSecrets = prev;
  };
}

/**
 * Resolve `dna.env` entries of the form `{ secret: "REF" }` via SecretStore.
 * Plain string values pass through. Missing secrets are omitted (not thrown)
 * so apply still succeeds; doctor can flag missing refs.
 */
export async function resolveDnaSecrets(
  dna: AgentDna,
  store: SecretStore
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const env = dna.env;
  if (!env || typeof env !== 'object') return out;

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      out[key] = value;
      continue;
    }
    if (value && typeof value === 'object' && typeof value.secret === 'string') {
      const resolved = await store.get(value.secret);
      if (resolved !== undefined) {
        out[key] = resolved;
      }
    }
  }
  return out;
}

/** Keys that look like secrets — redact in logs/timeline printers. */
const SECRET_KEY_RE = /(secret|password|passwd|token|api[_-]?key|authorization|credential)/i;

export function redactSecrets<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_RE.test(k) && typeof v === 'string') {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      out[k] = redactValue(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
