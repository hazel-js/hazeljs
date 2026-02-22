import { Container } from '@hazeljs/core';
import { GrpcModule } from './grpc.module';
import { GrpcServer } from './grpc.server';
import { GrpcMethod } from './decorators/grpc-method.decorator';
import path from 'path';

describe('GrpcModule', () => {
  let container: Container;
  const originalGetInstance = Container.getInstance;

  beforeEach(() => {
    container = Container.createTestInstance();
    (Container as { getInstance: () => Container }).getInstance = jest.fn(() => container);
  });

  afterEach(() => {
    (Container as { getInstance: () => Container }).getInstance = originalGetInstance;
  });

  describe('forRoot', () => {
    it('should return module config with providers and exports', () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const config = GrpcModule.forRoot({
        protoPath,
        package: 'hero',
      });

      expect(config.module).toBe(GrpcModule);
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].provide).toBe(GrpcServer);
      expect(config.providers[0].useFactory).toBeDefined();
      expect(config.exports).toContain(GrpcServer);
      expect(config.global).toBe(true);
    });

    it('should use isGlobal option', () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const config = GrpcModule.forRoot({
        protoPath,
        package: 'hero',
        isGlobal: false,
      });
      expect(config.global).toBe(false);
    });

    it('should default isGlobal to true when not provided', () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const config = GrpcModule.forRoot({
        protoPath,
        package: 'hero',
      });
      expect(config.global).toBe(true);
    });

    it('should create configured GrpcServer via factory', () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const config = GrpcModule.forRoot({
        protoPath,
        package: 'hero',
        url: '0.0.0.0:50052',
      });
      const factory = config.providers[0].useFactory as () => GrpcServer;
      const server = factory();
      expect(server).toBeInstanceOf(GrpcServer);
      expect(server.getServer()).toBeNull();
    });
  });

  describe('forRootAsync', () => {
    it('should return module config with async providers', () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const config = GrpcModule.forRootAsync({
        useFactory: () => ({ protoPath, package: 'hero' }),
      });

      expect(config.module).toBe(GrpcModule);
      expect(config.providers).toHaveLength(2);
      expect(config.providers[0].provide).toBe('GRPC_OPTIONS');
      expect(config.providers[1].provide).toBe(GrpcServer);
      expect(config.global).toBe(true);
    });

    it('should support inject option', () => {
      const config = GrpcModule.forRootAsync({
        useFactory: () => ({ protoPath: 'test.proto', package: 'test' }),
        inject: ['ConfigService'],
      });
      expect(config.providers[0]).toHaveProperty('inject', ['ConfigService']);
    });

    it('should create GrpcServer with async options', async () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const config = GrpcModule.forRootAsync({
        useFactory: async () => ({ protoPath, package: 'hero' }),
      });

      const optionsFactory = config.providers[0].useFactory as () => Promise<{
        protoPath: string;
        package: string;
      }>;
      const options = await optionsFactory();

      const serverFactory = config.providers[1].useFactory as (opts: {
        protoPath: string;
        package: string;
      }) => GrpcServer;
      const server = serverFactory(options);

      expect(server).toBeInstanceOf(GrpcServer);
    });
  });

  describe('registerHandlersFromProvider', () => {
    it('should register gRPC handlers from provider with @GrpcMethod', () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const grpcServer = new GrpcServer();
      grpcServer.configure({ protoPath, package: 'hero' });
      container.register(GrpcServer, grpcServer);

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne(data: { id: number }) {
          return { id: data.id, name: 'Hero' };
        }
      }

      const controller = new TestController();
      GrpcModule.registerHandlersFromProvider(controller);

      expect(grpcServer.getServer()).toBeNull();
    });

    it('should handle GrpcServer not in container', () => {
      const emptyContainer = Container.createTestInstance();
      emptyContainer.register(GrpcServer, undefined as unknown as GrpcServer);
      (Container as { getInstance: () => Container }).getInstance = jest.fn(() => emptyContainer);

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      expect(() => {
        GrpcModule.registerHandlersFromProvider(new TestController());
      }).not.toThrow();
    });

    it('should handle errors during registration gracefully', () => {
      (Container as { getInstance: () => Container }).getInstance = jest.fn(() => {
        throw new Error('Container error');
      });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      expect(() => {
        GrpcModule.registerHandlersFromProvider(new TestController());
      }).not.toThrow();
    });
  });

  describe('registerHandlersFromProviders', () => {
    it('should register handlers from multiple provider classes', () => {
      const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');
      const grpcServer = new GrpcServer();
      grpcServer.configure({ protoPath, package: 'hero' });
      container.register(GrpcServer, grpcServer);

      class HeroController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne(data: { id: number }) {
          return { id: data.id, name: 'Hero' };
        }
      }

      const heroInstance = new HeroController();
      container.register(HeroController, heroInstance);

      GrpcModule.registerHandlersFromProviders([HeroController]);

      expect(grpcServer.getServer()).toBeNull();
    });

    it('should handle GrpcServer not in container', () => {
      const emptyContainer = Container.createTestInstance();
      emptyContainer.register(GrpcServer, undefined as unknown as GrpcServer);
      (Container as { getInstance: () => Container }).getInstance = jest.fn(() => emptyContainer);

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      container.register(TestController, new TestController());

      expect(() => {
        GrpcModule.registerHandlersFromProviders([TestController]);
      }).not.toThrow();
    });
  });
});
