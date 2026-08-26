/**
 * Effect decorators — declare tool effect class for Agent VM.
 */

import 'reflect-metadata';
import { EffectKind, EffectMetadata } from './effect-kind';

export const EFFECT_METADATA_KEY = Symbol('hazel:agent-vm:effect');
export const COMPENSATE_METADATA_KEY = Symbol('hazel:agent-vm:compensate');

function defineEffect(kind: EffectKind, options?: Partial<EffectMetadata>): MethodDecorator {
  return (target, propertyKey) => {
    const existing: EffectMetadata =
      Reflect.getMetadata(EFFECT_METADATA_KEY, target, propertyKey) ?? {};
    const metadata: EffectMetadata = {
      ...existing,
      kind,
      ...options,
    };
    Reflect.defineMetadata(EFFECT_METADATA_KEY, metadata, target, propertyKey);
  };
}

/** No I/O, deterministic — freely re-runnable and cacheable. */
export function Pure(): MethodDecorator {
  return defineEffect(EffectKind.PURE);
}

/** Observes external state, mutates nothing — safe in any branch. */
export function Read(): MethodDecorator {
  return defineEffect(EffectKind.READ);
}

/** Mutates with a paired inverse via @Compensate — safe to speculate. */
export function Reversible(options: { compensate: string }): MethodDecorator {
  return defineEffect(EffectKind.REVERSIBLE, { compensate: options.compensate });
}

/** Cannot be undone — acts as a speculation barrier. */
export function Irreversible(options?: {
  predict?: (input: Record<string, unknown>) => unknown;
}): MethodDecorator {
  return defineEffect(EffectKind.IRREVERSIBLE, { predict: options?.predict });
}

export function getEffectMetadata(
  target: object,
  propertyKey: string | symbol
): EffectMetadata | undefined {
  return Reflect.getMetadata(EFFECT_METADATA_KEY, target, propertyKey);
}

export function hasEffectMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(EFFECT_METADATA_KEY, target, propertyKey);
}
