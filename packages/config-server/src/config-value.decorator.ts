import { ConfigClient } from './config-client';
import type { ConfigValueOptions } from './types';

function coerce(value: unknown, type?: ConfigValueOptions['type']): unknown {
  if (value === undefined || !type) {
    return value;
  }
  if (type === 'number') {
    return Number(value);
  }
  if (type === 'boolean') {
    return value === true || value === 'true';
  }
  return String(value);
}

/**
 * Inject a remote/git-backed config value onto a class property.
 * Reads from the process-wide ConfigClient. Use `{ refresh: true }` so getters
 * always hit the latest snapshot after `client.refresh()`.
 */
export function ConfigValue(key: string, options: ConfigValueOptions = {}): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const storageKey = Symbol(`config:${String(propertyKey)}`);
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: true,
      get(this: Record<symbol, unknown>) {
        if (!options.refresh && this[storageKey] !== undefined) {
          return this[storageKey];
        }
        const client = ConfigClient.getInstance();
        const raw = client.get(key, options.default);
        const value = coerce(raw, options.type);
        if (!options.refresh) {
          this[storageKey] = value;
        }
        return value;
      },
      set(this: Record<symbol, unknown>, value: unknown) {
        this[storageKey] = value;
      },
    });
  };
}
