import 'reflect-metadata';
import { HealingRegistry } from '../healing/healing-coordinator';
import { createGracefulDrainCoordinator } from '../drain/graceful-drain';
import { MemoryGuardMonitor } from '../memory/memory-guard';
import { MemoryGuardOptions, SelfHealMethodOptions, SelfHealingModuleOptions } from '../types';

const MODULE_OPTIONS_KEY = Symbol('hazeljs:self-healing:module');
const MEMORY_GUARD_KEY = Symbol('hazeljs:self-healing:memory-guard');
const DEFAULT_SCOPE = 'default';

type ClassTarget = {
  name: string;
  prototype: {
    onModuleInit?: (...args: unknown[]) => unknown;
    onModuleDestroy?: (...args: unknown[]) => unknown;
  };
};

/**
 * Module-level self-healing configuration.
 *
 * @example
 * @SelfHealing({ strategies: ['auto-restart', 'config-rollback'] })
 * export class AppModule {}
 */
export function SelfHealing(options: SelfHealingModuleOptions = {}): ClassDecorator {
  return function (constructor: ClassTarget) {
    const scope = constructor.name || DEFAULT_SCOPE;
    HealingRegistry.getOrCreate(scope, options);
    Reflect.defineMetadata(MODULE_OPTIONS_KEY, options, constructor);
  };
}

export function getSelfHealingModuleOptions(
  constructor: object
): SelfHealingModuleOptions | undefined {
  return Reflect.getMetadata(MODULE_OPTIONS_KEY, constructor);
}

/**
 * Method-level self-healing wrapper with diagnosis and recovery.
 *
 * @example
 * @SelfHeal({ onError: 'diagnose-and-fix', maxAttempts: 3, fallback: 'processPaymentSafe' })
 * async processPayment() { ... }
 */
export function SelfHeal(options: SelfHealMethodOptions = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const targetName = `${target.constructor.name}.${String(propertyKey)}`;
    const healName = options.name ?? targetName;

    descriptor.value = async function (
      this: Record<string, unknown>,
      ...args: unknown[]
    ): Promise<unknown> {
      const scope = target.constructor.name || DEFAULT_SCOPE;
      const coordinator = HealingRegistry.get(scope) ?? HealingRegistry.getOrCreate(scope);

      return coordinator.executeWithHealing(
        healName,
        () => originalMethod.apply(this, args),
        options,
        this,
        args
      );
    };

    return descriptor;
  };
}

/**
 * Class-level memory guard that monitors heap usage.
 *
 * @example
 * @MemoryGuard({ threshold: '500MB', action: 'memory-cleanup' })
 * export class DataProcessingService {}
 */
export function MemoryGuard(options: MemoryGuardOptions = {}): ClassDecorator {
  return function (constructor: ClassTarget) {
    const drainCoordinator =
      options.drain === false
        ? undefined
        : createGracefulDrainCoordinator(
            typeof options.drain === 'object' ? options.drain : undefined
          );

    const monitor = new MemoryGuardMonitor(options, drainCoordinator);
    Reflect.defineMetadata(MEMORY_GUARD_KEY, monitor, constructor);

    const originalInit = constructor.prototype.onModuleInit;
    constructor.prototype.onModuleInit = async function (...args: unknown[]): Promise<void> {
      monitor.start();
      if (typeof originalInit === 'function') {
        await originalInit.apply(this, args);
      }
    };

    const originalDestroy = constructor.prototype.onModuleDestroy;
    constructor.prototype.onModuleDestroy = async function (...args: unknown[]): Promise<void> {
      monitor.stop();
      if (typeof originalDestroy === 'function') {
        await originalDestroy.apply(this, args);
      }
    };
  };
}

export function getMemoryGuardMonitor(constructor: object): MemoryGuardMonitor | undefined {
  return Reflect.getMetadata(MEMORY_GUARD_KEY, constructor);
}
