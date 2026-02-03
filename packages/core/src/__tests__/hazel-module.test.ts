import { HazelModule, Module, getModuleMetadata, HazelModuleInstance } from '../hazel-module';
import 'reflect-metadata';

// Mock logger
jest.mock('../logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  isDebugEnabled: jest.fn().mockReturnValue(false),
}));

// Mock container
jest.mock('../container', () => {
  const actualContainer = jest.requireActual('../container');
  return {
    ...actualContainer,
    Container: {
      getInstance: jest.fn(() => actualContainer.Container.createTestInstance()),
      createTestInstance: actualContainer.Container.createTestInstance,
    },
  };
});

describe('HazelModule', () => {
  describe('HazelModule decorator', () => {
    it('should set module metadata', () => {
      @HazelModule({
        controllers: [],
        providers: [],
      })
      class TestModule {}

      const metadata = getModuleMetadata(TestModule);

      expect(metadata).toBeDefined();
      expect(metadata?.controllers).toEqual([]);
      expect(metadata?.providers).toEqual([]);
    });

    it('should set metadata with imports', () => {
      class ImportedModule {}

      @HazelModule({
        imports: [ImportedModule],
      })
      class TestModule {}

      const metadata = getModuleMetadata(TestModule);

      expect(metadata?.imports).toEqual([ImportedModule]);
    });

    it('should set metadata with exports', () => {
      class ExportedService {}

      @HazelModule({
        exports: [ExportedService],
      })
      class TestModule {}

      const metadata = getModuleMetadata(TestModule);

      expect(metadata?.exports).toEqual([ExportedService]);
    });
  });

  describe('Module alias', () => {
    it('should work as alias for HazelModule', () => {
      @Module({
        controllers: [],
      })
      class TestModule {}

      const metadata = getModuleMetadata(TestModule);

      expect(metadata).toBeDefined();
    });
  });

  describe('getModuleMetadata', () => {
    it('should return undefined for class without metadata', () => {
      class PlainClass {}

      const metadata = getModuleMetadata(PlainClass);

      expect(metadata).toBeUndefined();
    });

    it('should return metadata for decorated class', () => {
      @HazelModule({
        providers: [],
      })
      class TestModule {}

      const metadata = getModuleMetadata(TestModule);

      expect(metadata).toBeDefined();
      expect(metadata?.providers).toEqual([]);
    });
  });

  describe('HazelModuleInstance', () => {
    describe('initialization', () => {
      it('should initialize module without metadata', () => {
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
        expect(instance.getContainer()).toBeDefined();
      });

      it('should initialize module with providers', () => {
        class TestService {
          getValue() {
            return 'test';
          }
        }

        @HazelModule({
          providers: [TestService],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });

      it('should initialize module with controllers', () => {
        class TestController {
          getStatus() {
            return 'ok';
          }
        }

        @HazelModule({
          controllers: [TestController],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });

      it('should initialize module with imports', () => {
        @HazelModule({})
        class ImportedModule {}

        @HazelModule({
          imports: [ImportedModule],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });
    });

    describe('request-scoped providers', () => {
      it('should handle request-scoped providers', () => {
        class RequestScopedService {}
        Reflect.defineMetadata('hazel:scope', 'request', RequestScopedService);

        @HazelModule({
          providers: [RequestScopedService],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });

      it('should handle singleton providers', () => {
        class SingletonService {}

        @HazelModule({
          providers: [SingletonService],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });
    });

    describe('controllers with dependencies', () => {
      it('should handle controller with request-scoped dependencies', () => {
        class RequestScopedService {}
        Reflect.defineMetadata('hazel:scope', 'request', RequestScopedService);

        class TestController {
          constructor(public service: RequestScopedService) {}
        }
        Reflect.defineMetadata('design:paramtypes', [RequestScopedService], TestController);

        @HazelModule({
          providers: [RequestScopedService],
          controllers: [TestController],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });

      it('should handle controller without request-scoped dependencies', () => {
        class NormalService {}

        class TestController {
          constructor(public service: NormalService) {}
        }
        Reflect.defineMetadata('design:paramtypes', [NormalService], TestController);

        @HazelModule({
          providers: [NormalService],
          controllers: [TestController],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });

      it('should handle controller without dependencies', () => {
        class TestController {
          getStatus() {
            return 'ok';
          }
        }

        @HazelModule({
          controllers: [TestController],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });

      it('should handle controller with null paramTypes', () => {
        class TestController {}
        Reflect.defineMetadata('design:paramtypes', [null], TestController);

        @HazelModule({
          controllers: [TestController],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });
    });

    describe('route registration', () => {
      it('should register controller routes', () => {
        class TestController {
          getUsers() {
            return [];
          }

          getUser() {
            return {};
          }
        }

        Reflect.defineMetadata(
          'hazel:route',
          { method: 'GET', path: '/users' },
          TestController.prototype,
          'getUsers'
        );

        Reflect.defineMetadata(
          'hazel:route',
          { method: 'GET', path: '/users/:id' },
          TestController.prototype,
          'getUser'
        );

        @HazelModule({
          controllers: [TestController],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });

      it('should handle controller without routes', () => {
        class TestController {
          someMethod() {
            return 'test';
          }
        }

        @HazelModule({
          controllers: [TestController],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });
    });

    describe('nested modules', () => {
      it('should initialize nested imported modules', () => {
        @HazelModule({})
        class Level3Module {}

        @HazelModule({
          imports: [Level3Module],
        })
        class Level2Module {}

        @HazelModule({
          imports: [Level2Module],
        })
        class Level1Module {}

        const instance = new HazelModuleInstance(Level1Module);

        expect(instance).toBeDefined();
      });

      it('should handle multiple imports', () => {
        @HazelModule({})
        class Module1 {}

        @HazelModule({})
        class Module2 {}

        @HazelModule({})
        class Module3 {}

        @HazelModule({
          imports: [Module1, Module2, Module3],
        })
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);

        expect(instance).toBeDefined();
      });
    });

    describe('getContainer', () => {
      it('should return container instance', () => {
        @HazelModule({})
        class TestModule {}

        const instance = new HazelModuleInstance(TestModule);
        const container = instance.getContainer();

        expect(container).toBeDefined();
      });
    });

    describe('complex scenarios', () => {
      it('should handle module with all options', () => {
        class SharedService {}

        @HazelModule({
          providers: [SharedService],
          exports: [SharedService],
        })
        class SharedModule {}

        class AppService {}
        class AppController {}

        @HazelModule({
          imports: [SharedModule],
          providers: [AppService],
          controllers: [AppController],
          exports: [AppService],
        })
        class AppModule {}

        const instance = new HazelModuleInstance(AppModule);

        expect(instance).toBeDefined();
      });

      it('should handle empty module options', () => {
        @HazelModule({})
        class EmptyModule {}

        const instance = new HazelModuleInstance(EmptyModule);

        expect(instance).toBeDefined();
      });
    });
  });
});
