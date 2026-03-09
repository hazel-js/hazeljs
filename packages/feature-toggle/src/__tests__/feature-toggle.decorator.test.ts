/// <reference types="jest" />
import 'reflect-metadata';
import { createFeatureToggleGuard } from '../feature-toggle.guard';
import { FeatureToggle } from '../feature-toggle.decorator';
import { FeatureToggleService } from '../feature-toggle.service';

jest.mock('@hazeljs/core', () => {
  const actual = jest.requireActual('@hazeljs/core');
  return {
    ...actual,
    Service: () => () => undefined,
    UseGuards: (...guards: unknown[]) => {
      return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
        if (propertyKey !== undefined && descriptor !== undefined) {
          const existing = Reflect.getMetadata('hazel:guards', target, propertyKey) || [];
          Reflect.defineMetadata('hazel:guards', [...existing, ...guards], target, propertyKey);
          return descriptor;
        }
        const existing = Reflect.getMetadata('hazel:guards', target) || [];
        Reflect.defineMetadata('hazel:guards', [...existing, ...guards], target);
      };
    },
  };
});

describe('createFeatureToggleGuard', () => {
  beforeEach(() => {
    FeatureToggleService.setOptions({});
  });

  it('returns a class that allows access when feature is enabled', () => {
    const GuardClass = createFeatureToggleGuard('testFlag');
    const service = new FeatureToggleService();
    service.set('testFlag', true);
    const guard = new GuardClass(service);
    expect(guard.canActivate({} as never)).toBe(true);
  });

  it('returns a class that denies access when feature is disabled', () => {
    const GuardClass = createFeatureToggleGuard('testFlag');
    const service = new FeatureToggleService();
    service.set('testFlag', false);
    const guard = new GuardClass(service);
    expect(guard.canActivate({} as never)).toBe(false);
  });

  it('returns the same guard class for the same feature name (caching)', () => {
    const A = createFeatureToggleGuard('same');
    const B = createFeatureToggleGuard('same');
    expect(A).toBe(B);
  });

  it('returns different guard classes for different feature names', () => {
    const A = createFeatureToggleGuard('one');
    const B = createFeatureToggleGuard('two');
    expect(A).not.toBe(B);
  });
});

describe('FeatureToggle decorator', () => {
  it('applies guard metadata on method', () => {
    class TestController {
      @FeatureToggle('myFeature')
      handler() {}
    }
    const guards = Reflect.getMetadata('hazel:guards', TestController.prototype, 'handler');
    expect(guards).toBeDefined();
    expect(Array.isArray(guards)).toBe(true);
    expect(guards.length).toBe(1);
  });

  it('applies guard metadata on class', () => {
    @FeatureToggle('classFeature')
    class TestController {
      handler() {}
    }
    const guards = Reflect.getMetadata('hazel:guards', TestController);
    expect(guards).toBeDefined();
    expect(Array.isArray(guards)).toBe(true);
    expect(guards.length).toBe(1);
  });
});
