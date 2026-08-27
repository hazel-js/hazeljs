/**
 * @Atomic — marks an agent method/run as transactionally undo-able.
 */

export const ATOMIC_METADATA_KEY = Symbol('hazel:agent-vm:atomic');

export interface AtomicMetadata {
  /** When true, failed runs auto-undo on failure. */
  autoUndoOnFailure?: boolean;
}

export function Atomic(options?: AtomicMetadata): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata(ATOMIC_METADATA_KEY, options ?? {}, target, propertyKey);
  };
}

export function getAtomicMetadata(
  target: object,
  propertyKey: string | symbol
): AtomicMetadata | undefined {
  return Reflect.getMetadata(ATOMIC_METADATA_KEY, target, propertyKey);
}

export function isAtomicMethod(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(ATOMIC_METADATA_KEY, target, propertyKey);
}
