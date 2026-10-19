import { createHash } from 'crypto';

/**
 * Deterministic SHA-256 fingerprint for cached context identity.
 */
export function fingerprintContext(parts: {
  tenantId: string;
  agentId?: string;
  namespace: string;
  sourceVersion?: string;
  content: string;
  configuration?: Record<string, unknown>;
}): string {
  const payload = JSON.stringify({
    tenantId: parts.tenantId,
    agentId: parts.agentId ?? '',
    namespace: parts.namespace,
    sourceVersion: parts.sourceVersion ?? '',
    contentHash: sha256(parts.content),
    configuration: canonicalize(parts.configuration ?? {}),
  });
  return sha256(payload);
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = canonicalize(obj[key]);
  }
  return out;
}

export function buildCacheKey(parts: {
  tenantId: string;
  agentId?: string;
  namespace: string;
  version?: string;
  fingerprint: string;
}): string {
  return [
    'cag',
    parts.tenantId,
    parts.agentId ?? '_',
    parts.namespace,
    parts.version ?? '_',
    parts.fingerprint,
  ].join(':');
}

export function buildKeyPrefix(parts: {
  tenantId: string;
  agentId?: string;
  namespace?: string;
  version?: string;
}): string {
  const segments = ['cag', parts.tenantId];
  if (parts.agentId !== undefined) {
    segments.push(parts.agentId);
  }
  if (parts.namespace !== undefined) {
    if (parts.agentId === undefined) {
      // Match any agent under tenant+namespace via scan pattern handled by caller
      segments.push('*');
    }
    segments.push(parts.namespace);
  }
  if (parts.version !== undefined) {
    segments.push(parts.version);
  }
  return segments.join(':');
}
