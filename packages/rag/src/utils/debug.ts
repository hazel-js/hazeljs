/**
 * Lightweight debug logger gated by the `HAZELJS_DEBUG` environment variable.
 *
 * When `HAZELJS_DEBUG=true` (or `HAZELJS_DEBUG=1`), all debug messages are
 * printed to stderr with a `[hazeljs:<scope>]` prefix.
 *
 * Usage:
 * ```ts
 * import { debug } from '../utils/debug';
 * const log = debug('rag');
 *
 * log('retrieving documents for query=%s topK=%d', query, topK);
 * ```
 *
 * This utility is intentionally zero-dependency and mirrors the pattern used
 * by popular libraries (debug, pino) without adding weight.
 */

export type DebugLogger = (message: string, ...args: unknown[]) => void;

let _enabled: boolean | null = null;

function isEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  const val = (typeof process !== 'undefined' && process.env?.HAZELJS_DEBUG) || '';
  _enabled = val === 'true' || val === '1' || val === '*';
  return _enabled;
}

/**
 * Create a scoped debug logger.
 *
 * @param scope Short label, e.g. `'rag'`, `'ai'`, `'agent'`, `'prompts'`
 */
export function debug(scope: string): DebugLogger {
  const prefix = `[hazeljs:${scope}]`;
  return (message: string, ...args: unknown[]) => {
    if (!isEnabled()) return;
    const timestamp = new Date().toISOString();
    // Simple %-style formatting for the most common cases
    let formatted = message;
    let argIdx = 0;
    formatted = formatted.replace(/%[sdoOj]/g, (spec) => {
      if (argIdx >= args.length) return spec;
      const arg = args[argIdx++];
      switch (spec) {
        case '%s':
          return String(arg);
        case '%d':
          return Number(arg).toString();
        case '%o':
        case '%O':
        case '%j':
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        default:
          return String(arg);
      }
    });
    // Append remaining args
    const remaining = args.slice(argIdx);
    const suffix =
      remaining.length > 0
        ? ' ' +
          remaining.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        : '';
    // eslint-disable-next-line no-console
    console.error(`${timestamp} ${prefix} ${formatted}${suffix}`);
  };
}

/**
 * Force enable/disable debug logging (useful in tests).
 */
export function setDebugEnabled(enabled: boolean): void {
  _enabled = enabled;
}
