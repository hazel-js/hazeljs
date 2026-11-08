import {
  assertCapabilityRetrySafety,
  getAutonomousMetadata,
  getCapabilityMetadata,
  getCapabilityMethods,
  getObserveMetadata,
  getObserveMethods,
  type CapabilityEffect,
} from '@hazeljs/core';
import type { RegisteredAutonomousService, RegisteredCapability } from '../types';
import { mergeLoopProtection } from '../observation/loop-protection';

export function effectToGateClassification(
  effect: CapabilityEffect
): 'read' | 'write' | 'destructive' {
  switch (effect) {
    case 'read-only':
      return 'read';
    case 'idempotent':
    case 'reversible':
      return 'write';
    case 'irreversible':
    default:
      return 'destructive';
  }
}

export class CapabilityRegistry {
  private readonly services = new Map<string, RegisteredAutonomousService>();
  private readonly capabilities = new Map<string, RegisteredCapability>();
  private readonly observers = new Map<
    string,
    Array<{ serviceId: string; propertyKey: string; recordOnly: boolean }>
  >();

  registerServiceInstance(
    target: new (...args: unknown[]) => unknown,
    instance: object
  ): RegisteredAutonomousService {
    const auto = getAutonomousMetadata(target);
    if (!auto) {
      throw new Error(`Class ${target.name} is not @Autonomous`);
    }

    const id = auto.options.id ?? target.name;
    const retryAttempts = auto.options.recovery?.retry?.attempts;

    const service: RegisteredAutonomousService = {
      id,
      className: target.name,
      mode: auto.options.mode ?? 'observe-only',
      objective: auto.options.objective,
      capabilities: auto.options.capabilities ?? [],
      policies: auto.options.policies ?? [],
      loopProtection: mergeLoopProtection(auto.options.loopProtection),
      instance,
      target,
    };

    this.services.set(id, service);

    const grants = new Set(service.capabilities);

    for (const methodName of getCapabilityMethods(target)) {
      const meta = getCapabilityMetadata(target.prototype, methodName);
      if (!meta) continue;

      assertCapabilityRetrySafety(meta, retryAttempts, target.name);

      const granted = grants.has(meta.id);
      const bound = (instance as Record<string, (...args: unknown[]) => unknown>)[methodName];
      this.capabilities.set(meta.id, {
        id: meta.id,
        version: meta.version ?? '1',
        serviceId: id,
        effect: meta.effect ?? 'irreversible',
        approval: meta.approval ?? 'required',
        propertyKey: methodName,
        instance,
        method: typeof bound === 'function' ? bound.bind(instance) : meta.method.bind(instance),
        idempotencyKey: meta.idempotencyKey,
        reconcile: meta.reconcile,
        compensate: meta.compensate,
        granted,
      });
    }

    for (const methodName of getObserveMethods(target)) {
      const meta = getObserveMetadata(target.prototype, methodName);
      if (!meta) continue;
      const list = this.observers.get(meta.event) ?? [];
      list.push({
        serviceId: id,
        propertyKey: methodName,
        recordOnly: meta.recordOnly,
      });
      this.observers.set(meta.event, list);
    }

    return service;
  }

  getService(id: string): RegisteredAutonomousService | undefined {
    return this.services.get(id);
  }

  listServices(): RegisteredAutonomousService[] {
    return Array.from(this.services.values());
  }

  getCapability(id: string): RegisteredCapability | undefined {
    return this.capabilities.get(id);
  }

  listCapabilities(): RegisteredCapability[] {
    return Array.from(this.capabilities.values());
  }

  observersFor(eventType: string): Array<{
    serviceId: string;
    propertyKey: string;
    recordOnly: boolean;
  }> {
    return this.observers.get(eventType) ?? [];
  }

  clear(): void {
    this.services.clear();
    this.capabilities.clear();
    this.observers.clear();
  }
}
