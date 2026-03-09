import { Injectable, type CanActivate, type ExecutionContext, type Type } from '@hazeljs/core';
import { FeatureToggleService } from './feature-toggle.service';

const guardCache = new Map<string, Type<CanActivate>>();

/**
 * Creates an injectable guard class that allows access only when the given
 * feature flag is enabled. Used internally by @FeatureToggle().
 */
export function createFeatureToggleGuard(featureName: string): Type<CanActivate> {
  let GuardClass = guardCache.get(featureName);
  if (GuardClass) {
    return GuardClass;
  }

  @Injectable()
  class FeatureToggleGuardImpl implements CanActivate {
    constructor(private readonly featureToggle: FeatureToggleService) {}

    canActivate(_context: ExecutionContext): boolean {
      return this.featureToggle.isEnabled(featureName);
    }
  }

  // Ensure the container resolves FeatureToggleService for the first constructor param
  // (design:paramtypes may not be reliable for dynamically created classes)
  Reflect.defineMetadata('hazel:inject', [FeatureToggleService], FeatureToggleGuardImpl);

  GuardClass = FeatureToggleGuardImpl as Type<CanActivate>;
  guardCache.set(featureName, GuardClass);
  return GuardClass;
}
