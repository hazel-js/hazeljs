/**
 * Built-in transformers for common data operations
 */

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
