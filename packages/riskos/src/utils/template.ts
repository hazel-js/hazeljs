/**
 * Simple template resolver: {{path.to.value}} from state
 */

import { get } from './jsonpath';

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

/**
 * Resolve {{path.to.value}} placeholders from state object
 */
export function resolveTemplate(template: string, state: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_RE, (_, path: string) => {
    const value = get(state, path.trim());
    return value != null ? String(value) : '';
  });
}

/**
 * Resolve templates in object recursively (for body, nested config)
 */
export function resolveTemplateDeep(obj: unknown, state: Record<string, unknown>): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return resolveTemplate(obj, state);
  if (Array.isArray(obj)) return obj.map((item) => resolveTemplateDeep(item, state));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = resolveTemplateDeep(v, state);
    }
    return out;
  }
  return obj;
}
