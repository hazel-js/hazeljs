/**
 * Autonomous Application Runtime decorators (metadata only).
 */

import 'reflect-metadata';
import { assertValidAutonomousOptions, assertValidCapabilityOptions } from './validate';
import type {
  AutonomousMetadata,
  AutonomousOptions,
  CapabilityMetadata,
  CapabilityOptions,
  ObserveMetadata,
  ObserveOptions,
} from './types';

type NewableFunction = new (...args: unknown[]) => unknown;

export const AUTONOMOUS_METADATA_KEY = Symbol('hazel:autonomous');
export const OBSERVE_METADATA_KEY = Symbol('hazel:autonomous:observe');
export const OBSERVE_LIST_KEY = Symbol('hazel:autonomous:observe-list');
export const CAPABILITY_METADATA_KEY = Symbol('hazel:autonomous:capability');
export const CAPABILITY_LIST_KEY = Symbol('hazel:autonomous:capability-list');

const GLOBAL_AUTONOMOUS_REGISTRY = new Set<NewableFunction>();

function normalizeObserveInput(
  eventOrOptions: string | ObserveOptions
): Required<Pick<ObserveOptions, 'event' | 'schemaVersion' | 'recordOnly'>> {
  if (typeof eventOrOptions === 'string') {
    return { event: eventOrOptions, schemaVersion: 1, recordOnly: false };
  }
  return {
    event: eventOrOptions.event,
    schemaVersion: eventOrOptions.schemaVersion ?? 1,
    recordOnly: eventOrOptions.recordOnly ?? false,
  };
}

/**
 * Marks an injectable service as optionally autonomous.
 * The class remains a normal service and is callable without an agent loop.
 */
export function Autonomous(options: AutonomousOptions = {}): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    const serviceName = target.name || 'AnonymousService';
    assertValidAutonomousOptions(options, serviceName);

    const metadata: AutonomousMetadata = {
      options: {
        mode: options.mode ?? 'observe-only',
        ...options,
      },
      target: target as NewableFunction,
    };

    Reflect.defineMetadata(AUTONOMOUS_METADATA_KEY, metadata, target);
    GLOBAL_AUTONOMOUS_REGISTRY.add(target as NewableFunction);
  }) as ClassDecorator;
}

type LegacyMethodDecorator = (
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
) => PropertyDescriptor | void;

/**
 * Subscribe a method to an application observation signal.
 * Typed for TypeScript `experimentalDecorators` (legacy 3-arg method decorators).
 */
export function Observe(eventOrOptions: string | ObserveOptions): LegacyMethodDecorator {
  return (target, propertyKey, descriptor) => {
    const methodName = String(propertyKey);
    const normalized = normalizeObserveInput(eventOrOptions);

    if (!normalized.event.trim()) {
      throw new Error(`@Observe on ${methodName}: event type is required`);
    }

    const metadata: ObserveMetadata = {
      event: normalized.event,
      schemaVersion: normalized.schemaVersion,
      recordOnly: normalized.recordOnly,
      propertyKey: methodName,
      method: descriptor.value,
    };

    Reflect.defineMetadata(OBSERVE_METADATA_KEY, metadata, target, propertyKey);

    const ctor = target.constructor;
    const existing: string[] = Reflect.getMetadata(OBSERVE_LIST_KEY, ctor) || [];
    if (!existing.includes(methodName)) {
      existing.push(methodName);
      Reflect.defineMetadata(OBSERVE_LIST_KEY, existing, ctor);
    }

    return descriptor;
  };
}

/**
 * Expose a method as a governed capability (default-deny until granted).
 * Typed for TypeScript `experimentalDecorators` (legacy 3-arg method decorators).
 */
export function Capability(options: CapabilityOptions): LegacyMethodDecorator {
  return (target, propertyKey, descriptor) => {
    const methodName = String(propertyKey);
    const serviceName = target.constructor?.name || 'AnonymousService';
    assertValidCapabilityOptions(options, serviceName, methodName);

    const metadata: CapabilityMetadata = {
      ...options,
      version: options.version ?? '1',
      effect: options.effect ?? 'irreversible',
      approval: options.approval ?? 'required',
      timeoutMs: options.timeoutMs ?? 30_000,
      propertyKey: methodName,
      method: descriptor.value,
      agentClass: target.constructor as NewableFunction,
    };

    Reflect.defineMetadata(CAPABILITY_METADATA_KEY, metadata, target, propertyKey);

    const ctor = target.constructor;
    const existing: string[] = Reflect.getMetadata(CAPABILITY_LIST_KEY, ctor) || [];
    if (!existing.includes(methodName)) {
      existing.push(methodName);
      Reflect.defineMetadata(CAPABILITY_LIST_KEY, existing, ctor);
    }

    return descriptor;
  };
}

export function getRegisteredAutonomousServices(): NewableFunction[] {
  return Array.from(GLOBAL_AUTONOMOUS_REGISTRY);
}

export function getAutonomousMetadata(target: NewableFunction): AutonomousMetadata | undefined {
  return Reflect.getMetadata(AUTONOMOUS_METADATA_KEY, target);
}

export function isAutonomous(target: NewableFunction): boolean {
  return Reflect.hasMetadata(AUTONOMOUS_METADATA_KEY, target);
}

export function getObserveMetadata(
  target: object,
  propertyKey: string
): ObserveMetadata | undefined {
  return Reflect.getMetadata(OBSERVE_METADATA_KEY, target, propertyKey);
}

export function getObserveMethods(agentClass: NewableFunction): string[] {
  return Reflect.getMetadata(OBSERVE_LIST_KEY, agentClass) || [];
}

export function getCapabilityMetadata(
  target: object,
  propertyKey: string
): CapabilityMetadata | undefined {
  return Reflect.getMetadata(CAPABILITY_METADATA_KEY, target, propertyKey);
}

export function getCapabilityMethods(agentClass: NewableFunction): string[] {
  return Reflect.getMetadata(CAPABILITY_LIST_KEY, agentClass) || [];
}

/** Test helper — clear global registry between tests. */
export function clearAutonomousRegistry(): void {
  GLOBAL_AUTONOMOUS_REGISTRY.clear();
}
