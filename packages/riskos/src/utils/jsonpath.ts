/**
 * Minimal JSONPath get/set - supports $.a.b[0] style paths
 */

const PATH_RE = /^(\$\.)?([^.\[\]]+)(\.([^.\[\]]+)|\[(\d+)\])*$/;

/**
 * Get value at JSONPath from object. Supports $.a.b[0].c
 */
export function get(obj: unknown, path: string): unknown {
  if (!obj || typeof path !== 'string') return undefined;
  const parts = parsePath(path);
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null) return undefined;
    if (typeof p === 'number') {
      current = Array.isArray(current) ? current[p] : undefined;
    } else {
      current = (current as Record<string, unknown>)[p];
    }
  }
  return current;
}

/**
 * Set value at JSONPath. Creates nested objects/arrays as needed.
 */
export function set(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = parsePath(path);
  if (parts.length === 0) return;
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = parts[i + 1];
    if (current == null) return;
    const key = typeof p === 'string' ? p : String(p);
    const parent = current as Record<string, unknown>;
    if (typeof next === 'number') {
      if (!Array.isArray(parent[key])) {
        parent[key] = [];
      }
      current = (parent[key] as unknown[])[next];
      if (current === undefined) {
        (parent[key] as unknown[])[next] = typeof parts[i + 2] === 'number' ? [] : {};
        current = (parent[key] as unknown[])[next];
      }
    } else {
      if (parent[key] === undefined) {
        parent[key] = typeof next === 'number' ? [] : {};
      }
      current = parent[key];
    }
  }
  const last = parts[parts.length - 1];
  const parent = current as Record<string, unknown>;
  if (typeof last === 'number') {
    const arr = Array.isArray(parent) ? parent : (current as unknown as unknown[]);
    arr[last] = value;
  } else if (parent && typeof parent === 'object') {
    (parent as Record<string, unknown>)[last] = value;
  }
}

function parsePath(path: string): (string | number)[] {
  const trimmed = path.replace(/^\$\.?/, '');
  if (!trimmed) return [];
  const result: (string | number)[] = [];
  let current = '';
  let inBracket = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === '[') {
      if (current) result.push(current);
      current = '';
      inBracket = true;
    } else if (c === ']') {
      if (inBracket && /^\d+$/.test(current)) {
        result.push(parseInt(current, 10));
      }
      current = '';
      inBracket = false;
    } else if (c === '.') {
      if (current && !inBracket) result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  if (current && !inBracket) result.push(current);
  return result;
}
