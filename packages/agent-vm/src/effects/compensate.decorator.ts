/**
 * @Compensate — pairs an inverse handler with a @Reversible tool.
 */

import { COMPENSATE_METADATA_KEY } from './effect.decorator';

export interface CompensateMetadata {
  /** Tool method name this handler undoes. */
  forTool: string;
}

/**
 * Marks a method as the compensation handler for a reversible tool.
 * The handler receives an EffectRecord (journal entry), not the original input.
 */
export function Compensate(forTool: string): MethodDecorator {
  return (target, propertyKey) => {
    const metadata: CompensateMetadata = { forTool };
    Reflect.defineMetadata(COMPENSATE_METADATA_KEY, metadata, target, propertyKey);
  };
}

export function getCompensateMetadata(
  target: object,
  propertyKey: string | symbol
): CompensateMetadata | undefined {
  return Reflect.getMetadata(COMPENSATE_METADATA_KEY, target, propertyKey);
}

/** Find compensate method name on agent instance for a given tool. */
export function findCompensateMethod(
  agentInstance: object,
  toolPropertyKey: string
): { propertyKey: string; method: (...args: unknown[]) => unknown } | undefined {
  const proto = Object.getPrototypeOf(agentInstance) as object;
  const keys = Object.getOwnPropertyNames(proto) as string[];

  for (const key of keys) {
    if (key === 'constructor') continue;
    const meta = getCompensateMetadata(proto, key);
    if (meta?.forTool === toolPropertyKey) {
      const method = (agentInstance as Record<string, unknown>)[key];
      if (typeof method === 'function') {
        return { propertyKey: key, method: method as (...args: unknown[]) => unknown };
      }
    }
  }

  return undefined;
}
