/**
 * Security utilities — safe cloning, path traversal protection, redaction.
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const DEFAULT_REDACT_KEYS = new Set([
  'password',
  'secret',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'ssn',
  'creditCard',
  'credit_card',
]);

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

/** Deep clone plain objects/arrays without prototype pollution. */
export function safeClone<T>(value: T, depth = 0, maxDepth = 32): T {
  if (depth > maxDepth) {
    return value;
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => safeClone(item, depth + 1, maxDepth)) as T;
  }
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenKey(key)) {
      continue;
    }
    out[key] = safeClone(val, depth + 1, maxDepth);
  }
  return out as T;
}

export function stripFields<T extends Record<string, unknown>>(input: T, fields: string[]): T {
  const out = safeClone(input) as T;
  for (const field of fields) {
    if (field.includes('.')) {
      const parts = field.split('.');
      let cursor: Record<string, unknown> = out;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (cursor[part] && typeof cursor[part] === 'object') {
          cursor = cursor[part] as Record<string, unknown>;
        } else {
          cursor = Object.create(null);
          break;
        }
      }
      delete cursor[parts[parts.length - 1]];
    } else {
      delete (out as Record<string, unknown>)[field];
    }
  }
  return out;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= 4) return '[REDACTED]';
    return `${value.slice(0, 2)}…[REDACTED]`;
  }
  if (typeof value === 'number') return 0;
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return redactObject(value as Record<string, unknown>);
  }
  return null;
}

export function redactObject(
  input: Record<string, unknown>,
  extraFields: string[] = []
): Record<string, unknown> {
  const fields = new Set([...DEFAULT_REDACT_KEYS, ...extraFields]);
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, val] of Object.entries(input)) {
    if (isForbiddenKey(key)) continue;
    if (fields.has(key) || fields.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = redactObject(val as Record<string, unknown>, extraFields);
    } else if (Array.isArray(val)) {
      out[key] = val.map((item) =>
        item && typeof item === 'object'
          ? redactObject(item as Record<string, unknown>, extraFields)
          : item
      );
    } else {
      out[key] = val;
    }
  }
  return out;
}

/** Match tool name against safe wildcard patterns (no regex injection). */
export function matchToolPattern(toolName: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === toolName;
  const parts = pattern.split('*');
  if (parts.length === 2) {
    const [prefix, suffix] = parts;
    return toolName.startsWith(prefix) && toolName.endsWith(suffix);
  }
  // Only support single * wildcard segments
  let remaining = toolName;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === parts.length - 1) {
      return remaining.endsWith(part);
    }
    const idx = remaining.indexOf(part);
    if (idx === -1) return false;
    remaining = remaining.slice(idx + part.length);
  }
  return true;
}

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => !isForbiddenKey(k))
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export function invocationFingerprint(parts: {
  agentId: string;
  toolName: string;
  input: unknown;
  tenantId?: string;
}): string {
  return canonicalJson({
    agentId: parts.agentId,
    toolName: parts.toolName,
    tenantId: parts.tenantId,
    input: parts.input,
  });
}

export function defaultClock(): import('./types').Clock {
  return { now: () => new Date() };
}

export function defaultIdGenerator(): import('./types').IdGenerator {
  let counter = 0;
  return () => {
    counter += 1;
    return `gk-${Date.now()}-${counter}`;
  };
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=[REDACTED]')
    .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]');
}
