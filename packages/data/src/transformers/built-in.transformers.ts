/**
 * Built-in transformers for common data operations
 */

import { createHash } from 'crypto';

export const trimString = (value: unknown): string => {
  if (typeof value !== 'string') return String(value);
  return value.trim();
};

export const toLowerCase = (value: unknown): string => {
  if (typeof value !== 'string') return String(value).toLowerCase();
  return value.toLowerCase();
};

export const toUpperCase = (value: unknown): string => {
  if (typeof value !== 'string') return String(value).toUpperCase();
  return value.toUpperCase();
};

export const parseJson = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return value;
};

export const stringifyJson = (value: unknown): string => {
  return JSON.stringify(value);
};

export const pick =
  (keys: string[]) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return {};
    const result: Record<string, unknown> = {};
    const source = obj as Record<string, unknown>;
    for (const key of keys) {
      if (key in source) result[key] = source[key];
    }
    return result;
  };

export const omit =
  (keys: string[]) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return {};
    const result: Record<string, unknown> = {};
    const source = obj as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      if (!keys.includes(key)) result[key] = source[key];
    }
    return result;
  };

export const renameKeys =
  (mapping: Record<string, string>) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return {};
    const result: Record<string, unknown> = {};
    const source = obj as Record<string, unknown>;
    for (const [oldKey, newKey] of Object.entries(mapping)) {
      if (oldKey in source) result[newKey] = source[oldKey];
    }
    for (const [key, value] of Object.entries(source)) {
      if (!(key in mapping)) result[key] = value;
    }
    return result;
  };

export type CastType = 'string' | 'number' | 'boolean' | 'date';

/**
 * Cast object fields to the given types.
 * @example cast({ age: 'number', active: 'boolean' })({ age: '42', active: 'true' })
 */
export const cast =
  (fieldTypes: Record<string, CastType>) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return {};
    const result = { ...(obj as Record<string, unknown>) };
    for (const [field, type] of Object.entries(fieldTypes)) {
      if (!(field in result)) continue;
      result[field] = castValue(result[field], type);
    }
    return result;
  };

function castValue(value: unknown, type: CastType): unknown {
  if (value === null || value === undefined) return value;
  switch (type) {
    case 'string':
      return String(value);
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : value;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
      }
      if (typeof value === 'number') return value !== 0;
      return Boolean(value);
    }
    case 'date': {
      if (value instanceof Date) return value;
      const d = new Date(value as string | number);
      return Number.isNaN(d.getTime()) ? value : d;
    }
    default:
      return value;
  }
}

/**
 * Parse date fields into Date objects (or ISO strings when asIso is true).
 */
export const parseDate =
  (fields: string[], options: { asIso?: boolean } = {}) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return {};
    const result = { ...(obj as Record<string, unknown>) };
    for (const field of fields) {
      if (!(field in result) || result[field] === null || result[field] === undefined) continue;
      const d =
        result[field] instanceof Date ? result[field] : new Date(result[field] as string | number);
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        result[field] = options.asIso ? d.toISOString() : d;
      }
    }
    return result;
  };

/**
 * Fill null/undefined fields with defaults.
 */
export const fillna =
  (defaults: Record<string, unknown>) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return { ...defaults };
    const result = { ...(obj as Record<string, unknown>) };
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (result[key] === null || result[key] === undefined) {
        result[key] = defaultValue;
      }
    }
    return result;
  };

/** Alias for fillna */
export const coalesce = fillna;

/**
 * Flatten nested objects into dotted keys (one level deep by default, or full depth).
 * @example flatten()({ a: { b: 1 } }) → { 'a.b': 1 }
 */
export const flatten =
  (options: { separator?: string; maxDepth?: number } = {}) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const separator = options.separator ?? '.';
    const maxDepth = options.maxDepth ?? Infinity;
    const result: Record<string, unknown> = {};

    const walk = (current: Record<string, unknown>, prefix: string, depth: number): void => {
      for (const [key, value] of Object.entries(current)) {
        const path = prefix ? `${prefix}${separator}${key}` : key;
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          !(value instanceof Date) &&
          depth < maxDepth
        ) {
          walk(value as Record<string, unknown>, path, depth + 1);
        } else {
          result[path] = value;
        }
      }
    };

    walk(obj as Record<string, unknown>, '', 0);
    return result;
  };

/**
 * Explode an array field into multiple records (one per array element).
 * Returns an array of records — use after collecting a single row.
 */
export const explode =
  (field: string) =>
  (obj: unknown): Record<string, unknown>[] => {
    if (obj === null || typeof obj !== 'object') return [];
    const source = obj as Record<string, unknown>;
    const arr = source[field];
    if (!Array.isArray(arr) || arr.length === 0) {
      return [{ ...source, [field]: undefined }];
    }
    return arr.map((item) => ({ ...source, [field]: item }));
  };

/**
 * Hash field values with SHA-256 (hex). Useful for PII tokenization.
 */
export const hash =
  (fields: string[], options: { algorithm?: string; prefix?: string } = {}) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return {};
    const result = { ...(obj as Record<string, unknown>) };
    const algo = options.algorithm ?? 'sha256';
    for (const field of fields) {
      if (result[field] === undefined || result[field] === null) continue;
      const digest = createHash(algo).update(String(result[field])).digest('hex');
      result[field] = options.prefix ? `${options.prefix}${digest}` : digest;
    }
    return result;
  };

/**
 * Deduplicate an array of records by key fields (keeps first occurrence).
 */
export const dedupe =
  (keyFields: string[]) =>
  (records: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(records)) return [];
    const seen = new Set<string>();
    const out: Record<string, unknown>[] = [];
    for (const item of records) {
      if (item === null || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const key = keyFields.map((f) => JSON.stringify(row[f])).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  };

/**
 * Enrich a record by looking up a key in a Map or record table.
 * @example lookupJoin('userId', userMap, 'user')({ userId: 'u1' })
 */
export const lookupJoin =
  (
    keyField: string,
    lookup: Map<unknown, unknown> | Record<string, unknown>,
    asField: string,
    options: { keepMissing?: boolean } = {}
  ) =>
  (obj: unknown): Record<string, unknown> => {
    if (obj === null || typeof obj !== 'object') return {};
    const result = { ...(obj as Record<string, unknown>) };
    const key = result[keyField];
    let value: unknown;
    if (lookup instanceof Map) {
      value = lookup.get(key);
    } else if (key !== undefined && key !== null) {
      value = lookup[String(key)];
    }
    if (value === undefined && !options.keepMissing) {
      return result;
    }
    result[asField] = value ?? null;
    return result;
  };

/** Names of all built-in transformers for auto-registration */
export const BUILT_IN_TRANSFORM_NAMES = [
  'trimString',
  'toLowerCase',
  'toUpperCase',
  'parseJson',
  'stringifyJson',
] as const;
