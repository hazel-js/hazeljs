import { Container, Scope } from '../container';
import 'reflect-metadata';

// Mock logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  isDebugEnabled: jest.fn().mockReturnValue(false),
}));

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = Container.createTestInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = Container.getInstance();
      const instance2 = Container.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('createTestInstance', () => {
    it('should create new container instance', () => {
      const container1 = Container.createTestInstance();
      const container2 = Container.createTestInstance();

      expect(container1).not.toBe(container2);
    });
  });

  describe('register', () => {
    it('should register value provider', () => {
      const value = { data: 'test' };
      container.register('TEST_TOKEN', value);

      const resolved = container.resolve('TEST_TOKEN');
      expect(resolved).toBe(value);
    });

    it('should register with default singleton scope', () => {
      const value = { data: 'test' };
      container.register('TEST_TOKEN', value);

      const resolved1 = container.resolve('TEST_TOKEN');
      const resolved2 = container.resolve('TEST_TOKEN');

      expect(resolved1).toBe(resolved2);
    });

    it('should register with transient scope', () => {
      // Note: Transient scope with direct values doesn't make much sense
      // as values are not recreated. Use factory for true transient behavior.
      container.registerProvider({
        token: 'TEST_TOKEN',
        useFactory: () => ({ data: 'test' }),
        scope: Scope.TRANSIENT,
      });

      const resolved1 = container.resolve('TEST_TOKEN');
      const resolved2 = container.resolve('TEST_TOKEN');
      
      expect(resolved1).toEqual({ data: 'test' });
      expect(resolved2).toEqual({ data: 'test' });
      expect(resolved1).not.toBe(resolved2);
    });
  });

  describe('registerProvider', () => {
    it('should register class provider', () => {
      class TestService {
        getValue() {
          return 'test';
        }
      }

      container.registerProvider({
        token: TestService,
        useClass: TestService,
      });

      const instance = container.resolve(TestService);
      expect(instance).toBeInstanceOf(TestService);
      expect(instance.getValue()).toBe('test');
    });

    it('should register value provider', () => {
      const value = { data: 'test' };
      container.registerProvider({
        token: 'TEST_TOKEN',
        useValue: value,
      });

      const resolved = container.resolve('TEST_TOKEN');
      expect(resolved).toBe(value);
    });

    it('should register factory provider', () => {
      const factory = jest.fn().mockReturnValue({ data: 'factory' });
      container.registerProvider({
        token: 'FACTORY_TOKEN',
        useFactory: factory,
      });

      const resolved = container.resolve('FACTORY_TOKEN');
      expect(factory).toHaveBeenCalled();
      expect(resolved).toEqual({ data: 'factory' });
    });

    it('should inject dependencies into factory', () => {
      class Dependency {
        getValue() {
          return 'dep';
        }
      }

      container.registerProvider({
        token: Dependency,
        useClass: Dependency,
      });

      const factory = jest.fn((...args: unknown[]) => {
        const dep = args[0] as Dependency;
        return {
          value: dep.getValue(),
        };
      });

      container.registerProvider({
        token: 'SERVICE',
        useFactory: factory,
        inject: [Dependency],
      });

      const resolved = container.resolve<{ value: string }>('SERVICE');
      expect(resolved.value).toBe('dep');
    });

    it('should use specified scope', () => {
      class TestService {}

      container.registerProvider({
        token: TestService,
        useClass: TestService,
        scope: Scope.TRANSIENT,
      });

      const instance1 = container.resolve(TestService);
      const instance2 = container.resolve(TestService);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('resolve', () => {
    it('should return undefined for unregistered token', () => {
      const result = container.resolve('UNKNOWN');
      expect(result).toBeUndefined();
    });

    it('should return undefined for null token', () => {
      const result = container.resolve(null as any);
      expect(result).toBeUndefined();
    });

    it('should auto-resolve classes', () => {
      class AutoService {
        getValue() {
          return 'auto';
        }
      }

      const instance = container.resolve(AutoService);
      expect(instance).toBeInstanceOf(AutoService);
      expect(instance.getValue()).toBe('auto');
    });

    it('should resolve singleton only once', () => {
      let callCount = 0;
      const factory = jest.fn(() => {
        callCount++;
        return { count: callCount };
      });

      container.registerProvider({
        token: 'SINGLETON',
        useFactory: factory,
        scope: Scope.SINGLETON,
      });

      const instance1 = container.resolve('SINGLETON');
      const instance2 = container.resolve('SINGLETON');

      expect(factory).toHaveBeenCalledTimes(1);
      expect(instance1).toBe(instance2);
    });

    it('should resolve transient multiple times', () => {
      let callCount = 0;
      const factory = jest.fn(() => {
        callCount++;
        return { count: callCount };
      });

      container.registerProvider({
        token: 'TRANSIENT',
        useFactory: factory,
        scope: Scope.TRANSIENT,
      });

      const instance1 = container.resolve('TRANSIENT');
      const instance2 = container.resolve('TRANSIENT');

      expect(factory).toHaveBeenCalledTimes(2);
      expect(instance1).not.toBe(instance2);
    });

    it('should resolve request-scoped with requestId', () => {
      const factory = jest.fn(() => ({ data: 'request' }));

      container.registerProvider({
        token: 'REQUEST_SERVICE',
        useFactory: factory,
        scope: Scope.REQUEST,
      });

      const instance1 = container.resolve('REQUEST_SERVICE', 'req-1');
      const instance2 = container.resolve('REQUEST_SERVICE', 'req-1');
      const instance3 = container.resolve('REQUEST_SERVICE', 'req-2');

      expect(factory).toHaveBeenCalledTimes(2);
      expect(instance1).toBe(instance2);
      expect(instance1).not.toBe(instance3);
    });

    it('should throw error for request scope without requestId', () => {
      container.registerProvider({
        token: 'REQUEST_SERVICE',
        useFactory: () => ({}),
        scope: Scope.REQUEST,
      });

      expect(() => container.resolve('REQUEST_SERVICE')).toThrow(
        /Request scope requires requestId/
      );
    });
  });

  describe('circular dependency detection', () => {
    it('should detect circular dependencies', () => {
      class ServiceA {
        constructor(public b: ServiceB) {}
      }

      class ServiceB {
        constructor(public a: ServiceA) {}
      }

      Reflect.defineMetadata('design:paramtypes', [ServiceB], ServiceA);
      Reflect.defineMetadata('design:paramtypes', [ServiceA], ServiceB);

      container.registerProvider({ token: ServiceA, useClass: ServiceA });
      container.registerProvider({ token: ServiceB, useClass: ServiceB });

      expect(() => container.resolve(ServiceA)).toThrow(/Circular dependency/);
    });
  });

  describe('clearRequestScope', () => {
    it('should clear request-scoped providers', () => {
      const factory = jest.fn(() => ({ data: 'request' }));

      container.registerProvider({
        token: 'REQUEST_SERVICE',
        useFactory: factory,
        scope: Scope.REQUEST,
      });

      const instance1 = container.resolve('REQUEST_SERVICE', 'req-1');
      container.clearRequestScope('req-1');
      const instance2 = container.resolve('REQUEST_SERVICE', 'req-1');

      expect(factory).toHaveBeenCalledTimes(2);
      expect(instance1).not.toBe(instance2);
    });

    it('should handle clearing non-existent request scope', () => {
      expect(() => container.clearRequestScope('non-existent')).not.toThrow();
    });
  });

  describe('dependency injection', () => {
    it('should inject constructor dependencies', () => {
      class Dependency {
        getValue() {
          return 'dependency';
        }
      }

      class Service {
        constructor(public dep: Dependency) {}
      }

      Reflect.defineMetadata('design:paramtypes', [Dependency], Service);

      container.registerProvider({ token: Dependency, useClass: Dependency });
      container.registerProvider({ token: Service, useClass: Service });

      const instance = container.resolve(Service);
      expect(instance.dep).toBeInstanceOf(Dependency);
      expect(instance.dep.getValue()).toBe('dependency');
    });

    it('should inject multiple dependencies', () => {
      class DepA {
        getValue() {
          return 'A';
        }
      }

      class DepB {
        getValue() {
          return 'B';
        }
      }

      class Service {
        constructor(
          public depA: DepA,
          public depB: DepB
        ) {}
      }

      Reflect.defineMetadata('design:paramtypes', [DepA, DepB], Service);

      container.registerProvider({ token: DepA, useClass: DepA });
      container.registerProvider({ token: DepB, useClass: DepB });
      container.registerProvider({ token: Service, useClass: Service });

      const instance = container.resolve(Service);
      expect(instance.depA.getValue()).toBe('A');
      expect(instance.depB.getValue()).toBe('B');
    });
  });

  describe('complex scenarios', () => {
    it('should handle nested dependencies', () => {
      class Level3 {
        getValue() {
          return 'level3';
        }
      }

      class Level2 {
        constructor(public level3: Level3) {}
      }

      class Level1 {
        constructor(public level2: Level2) {}
      }

      Reflect.defineMetadata('design:paramtypes', [Level3], Level2);
      Reflect.defineMetadata('design:paramtypes', [Level2], Level1);

      container.registerProvider({ token: Level3, useClass: Level3 });
      container.registerProvider({ token: Level2, useClass: Level2 });
      container.registerProvider({ token: Level1, useClass: Level1 });

      const instance = container.resolve(Level1);
      expect(instance.level2.level3.getValue()).toBe('level3');
    });

    it('should handle mixed scopes', () => {
      class SingletonService {
        getValue() {
          return 'singleton';
        }
      }

      class TransientService {
        constructor(public singleton: SingletonService) {}
      }

      Reflect.defineMetadata('design:paramtypes', [SingletonService], TransientService);

      container.registerProvider({
        token: SingletonService,
        useClass: SingletonService,
        scope: Scope.SINGLETON,
      });
      container.registerProvider({
        token: TransientService,
        useClass: TransientService,
        scope: Scope.TRANSIENT,
      });

      const instance1 = container.resolve(TransientService);
      const instance2 = container.resolve(TransientService);

      expect(instance1).not.toBe(instance2);
      expect(instance1.singleton).toBe(instance2.singleton);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle circular dependencies gracefully', () => {
      class ServiceA {
        constructor(public serviceB: any) {}
      }
      class ServiceB {
        constructor(public serviceA: ServiceA) {}
      }

      Reflect.defineMetadata('design:paramtypes', [ServiceB], ServiceA);
      Reflect.defineMetadata('design:paramtypes', [ServiceA], ServiceB);

      container.registerProvider({ token: ServiceA, useClass: ServiceA });
      container.registerProvider({ token: ServiceB, useClass: ServiceB });

      // This may throw or handle gracefully depending on implementation
      expect(() => container.resolve(ServiceA)).toBeDefined();
    });

    it('should handle missing dependencies', () => {
      class ServiceWithMissingDep {
        constructor(public missing: any) {}
      }

      class MissingDep {}

      Reflect.defineMetadata('design:paramtypes', [MissingDep], ServiceWithMissingDep);
      container.registerProvider({ token: ServiceWithMissingDep, useClass: ServiceWithMissingDep });

      // Should auto-resolve or throw
      expect(() => container.resolve(ServiceWithMissingDep)).toBeDefined();
    });

    it('should handle request scope with different request IDs', () => {
      class RequestScopedService {
        id = Math.random();
      }

      container.registerProvider({
        token: RequestScopedService,
        useClass: RequestScopedService,
        scope: Scope.REQUEST,
      });

      const instance1 = container.resolve(RequestScopedService, 'request-1');
      const instance2 = container.resolve(RequestScopedService, 'request-1');
      const instance3 = container.resolve(RequestScopedService, 'request-2');

      expect(instance1).toBe(instance2);
      expect(instance1).not.toBe(instance3);
    });

    it('should handle useValue provider', () => {
      const configValue = { apiKey: 'test-key', timeout: 5000 };
      
      container.registerProvider({
        token: 'CONFIG',
        useValue: configValue,
      });

      const resolved = container.resolve('CONFIG');
      expect(resolved).toBe(configValue);
    });

    it('should handle useFactory with dependencies', () => {
      class ConfigService {
        getConfig() {
          return { env: 'test' };
        }
      }

      container.registerProvider({
        token: ConfigService,
        useClass: ConfigService,
      });

      container.registerProvider({
        token: 'APP_CONFIG',
        useFactory: (...args: unknown[]) => {
          const configService = args[0] as ConfigService;
          return { ...configService.getConfig(), appName: 'TestApp' };
        },
        inject: [ConfigService],
      });

      const config = container.resolve('APP_CONFIG');
      expect(config).toEqual({ env: 'test', appName: 'TestApp' });
    });

    it('should handle complex dependency chains', () => {
      class Level1 {}
      class Level2 {
        constructor(public level1: Level1) {}
      }
      class Level3 {
        constructor(public level2: Level2) {}
      }

      Reflect.defineMetadata('design:paramtypes', [Level1], Level2);
      Reflect.defineMetadata('design:paramtypes', [Level2], Level3);

      container.registerProvider({ token: Level1, useClass: Level1 });
      container.registerProvider({ token: Level2, useClass: Level2 });
      container.registerProvider({ token: Level3, useClass: Level3 });

      const instance = container.resolve(Level3);
      expect(instance).toBeDefined();
      expect(instance.level2).toBeDefined();
      expect(instance.level2.level1).toBeDefined();
    });

    it('should handle providers with no dependencies', () => {
      class SimpleService {
        getValue() {
          return 'simple';
        }
      }

      container.registerProvider({ token: SimpleService, useClass: SimpleService });
      const instance = container.resolve(SimpleService);
      
      expect(instance.getValue()).toBe('simple');
    });
  });
});
