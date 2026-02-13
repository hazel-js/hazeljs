/**
 * PII redaction utilities - privacy by default
 */

import { createHash } from 'crypto';

/** Redact a string, showing only last N chars */
export function redactLast(str: string, visible = 4): string {
  if (!str || str.length <= visible) return '***';
  return '*'.repeat(Math.max(0, str.length - visible)) + str.slice(-visible);
}

/** SHA-256 hash for integrity (e.g. field hashes in audit) */
export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const DEFAULT_PII_FIELDS = [
  'email',
  'phone',
  'ssn',
  'taxId',
  'password',
  'creditCard',
  'firstName',
  'lastName',
  'name',
  'address',
  'street',
  'fullName',
  'idNumber',
  'dateOfBirth',
  'nationality',
];

function isPiiField(key: string, piiFields: string[]): boolean {
  const keyLower = key.toLowerCase();
  return piiFields.some((f) => keyLower.includes(f.toLowerCase()));
}

/** Redact known PII fields in an object (shallow) */
export function redactPii(
  obj: Record<string, unknown>,
  fields?: string[]
): Record<string, unknown> {
  const piiFields = fields ?? DEFAULT_PII_FIELDS;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isPiiField(k, piiFields)) {
      out[k] = v != null ? '[REDACTED]' : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Deep/recursive PII redaction for nested objects */
export function redactPiiDeep(obj: unknown, fields?: string[]): unknown {
  const piiFields = fields ?? DEFAULT_PII_FIELDS;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => redactPiiDeep(item, piiFields));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isPiiField(k, piiFields)) {
      out[k] = v != null ? '[REDACTED]' : v;
    } else {
      out[k] = redactPiiDeep(v, piiFields);
    }
  }
  return out;
}
