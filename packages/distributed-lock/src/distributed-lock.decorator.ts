import 'reflect-metadata';
import { DistributedLockOptions } from './interfaces';
import { LockManager } from './lock-manager';

/**
 * Decorator to enforce distributed locking on a method.
 *
 * @param options Lock options, including the key, TTL, and retry strategy.
 */
export function DistributedLock(options: DistributedLockOptions) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const lockManager = LockManager.getInstance();

      // Resolve dynamic key parts like {userId} from arguments
      let resolvedKey = options.key;
      const paramNames = getParamNames(originalMethod);

      // Simple template replacement
      paramNames.forEach((name, index) => {
        const value = args[index];
        const placeholder = `{${name}}`;
        if (resolvedKey.includes(placeholder)) {
          resolvedKey = resolvedKey.replace(placeholder, String(value));
        }
      });

      // Also try to resolve from properties of arguments if they are objects
      paramNames.forEach((name, index) => {
        const obj = args[index];
        if (obj && typeof obj === 'object') {
          for (const [prop, val] of Object.entries(obj)) {
            const placeholder = `{${name}.${prop}}`;
            if (resolvedKey.includes(placeholder)) {
              resolvedKey = resolvedKey.replace(placeholder, String(val));
            }
          }
        }
      });

      const lock = await lockManager.acquire({
        ...options,
        key: resolvedKey,
      });

      if (!lock) {
        throw new Error(`Could not acquire distributed lock for key: ${resolvedKey}`);
      }

      try {
        return await originalMethod.apply(this, args);
      } finally {
        await lock.release();
      }
    };

    return descriptor;
  };
}

/**
 * Utility to extract parameter names from a function.
 */
function getParamNames(fn: (...args: unknown[]) => unknown): string[] {
  const fnStr = fn.toString();
  const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(/([^\s,]+)/g);
  return result === null ? [] : result.map((p) => p.split('=')[0]); // ignore default values
}
