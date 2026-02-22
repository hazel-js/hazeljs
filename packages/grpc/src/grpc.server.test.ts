import 'reflect-metadata';
import { Container } from '@hazeljs/core';
import { GrpcServer } from './grpc.server';
import { GrpcMethod } from './decorators/grpc-method.decorator';
import * as grpc from '@grpc/grpc-js';
import path from 'path';

jest.mock('@grpc/grpc-js', () => {
  const actual = jest.requireActual('@grpc/grpc-js');
  return {
    ...actual,
    Server: jest.fn().mockImplementation(() => {
      const mockServer = {
        addService: jest.fn(),
        bindAsync: jest.fn(
          (_url: string, _creds: unknown, callback: (err: Error | null) => void) => {
            setImmediate(() => callback(null));
          }
        ),
        start: jest.fn(),
        tryShutdown: jest.fn((callback: (err: Error | null) => void) => {
          setImmediate(() => callback(null));
        }),
        forceShutdown: jest.fn(),
      };
      return mockServer;
    }),
  };
});

describe('GrpcServer', () => {
  let container: Container;
  const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');

  beforeEach(() => {
    container = Container.createTestInstance();
    (Container as { getInstance: () => Container }).getInstance = jest.fn(() => container);
  });

  describe('configure', () => {
    it('should load proto and set options', () => {
      const server = new GrpcServer();
      server.configure({
        protoPath,
        package: 'hero',
        url: '0.0.0.0:50052',
      });

      expect(server.getServer()).toBeNull();
    });

    it('should accept array of proto paths', () => {
      const server = new GrpcServer();
      server.configure({
        protoPath: [protoPath],
        package: 'hero',
      });

      expect(server.getServer()).toBeNull();
    });

    it('should accept loader options', () => {
      const server = new GrpcServer();
      server.configure({
        protoPath,
        package: 'hero',
        loader: { keepCase: false },
      });

      expect(server.getServer()).toBeNull();
    });
  });

  describe('registerHandlersFromProvider', () => {
    it('should register handler from provider with @GrpcMethod', () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne(data: { id: number }) {
          return { id: data.id, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());

      expect(server.getServer()).toBeNull();
    });

    it('should skip when method is not a function', () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne(_data: { id: number }) {
          return { id: 1, name: 'Hero' };
        }
      }

      const controller = new TestController();
      (controller as unknown as Record<string, unknown>).findOne = 'not a function';

      expect(() => server.registerHandlersFromProvider(controller)).not.toThrow();
    });

    it('should handle provider with no @GrpcMethod decorators', () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class PlainController {}

      expect(() => server.registerHandlersFromProvider(new PlainController())).not.toThrow();
    });

    it('should support default method name from property key', () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService')
        findOne(data: { id: number }) {
          return { id: data.id, name: 'Hero' };
        }
      }

      expect(() => server.registerHandlersFromProvider(new TestController())).not.toThrow();
    });
  });

  describe('registerHandlersFromProviders', () => {
    it('should register handlers from container-resolved providers', () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });
      container.register(GrpcServer, server);

      class HeroController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne(data: { id: number }) {
          return { id: data.id, name: 'Hero' };
        }
      }

      container.register(HeroController, new HeroController());
      server.registerHandlersFromProviders([HeroController]);

      expect(server.getServer()).toBeNull();
    });

    it('should skip provider when resolve returns undefined', () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });
      container.register(GrpcServer, server);

      class HeroController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      const originalResolve = container.resolve.bind(container);
      jest.spyOn(container, 'resolve').mockImplementation((token: unknown) => {
        if (token === HeroController) return undefined as unknown;
        return originalResolve(token as Parameters<typeof container.resolve>[0]);
      });

      expect(() => server.registerHandlersFromProviders([HeroController])).not.toThrow();
    });
  });

  describe('start', () => {
    it('should start server and bind to url', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero', url: '0.0.0.0:50051' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne(data: { id: number }) {
          return { id: data.id, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());

      await server.start();

      expect(server.getServer()).not.toBeNull();
      expect(grpc.Server).toHaveBeenCalled();
      const mockServer = (grpc.Server as jest.Mock).mock.results[0]?.value;
      expect(mockServer.addService).toHaveBeenCalled();
      expect(mockServer.bindAsync).toHaveBeenCalledWith(
        '0.0.0.0:50051',
        expect.anything(),
        expect.any(Function)
      );
      expect(mockServer.start).toHaveBeenCalled();

      await server.close();
    });

    it('should throw when not configured', async () => {
      const server = new GrpcServer();

      await expect(server.start()).rejects.toThrow(
        'GrpcServer not configured. Call configure() or use GrpcModule.forRoot() first.'
      );
    });

    it('should throw when package not found in proto', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'nonexistent_package' });

      await expect(server.start()).rejects.toThrow(
        'Package "nonexistent_package" not found in proto descriptor'
      );
    });

    it('should reject when bindAsync fails', async () => {
      const ServerMock = grpc.Server as jest.Mock;
      const originalImpl = ServerMock.getMockImplementation();
      ServerMock.mockImplementationOnce(() => ({
        addService: jest.fn(),
        bindAsync: jest.fn(
          (_url: string, _creds: unknown, callback: (err: Error | null) => void) => {
            setImmediate(() => callback(new Error('Bind failed')));
          }
        ),
        start: jest.fn(),
        tryShutdown: jest.fn(),
        forceShutdown: jest.fn(),
      }));

      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());

      await expect(server.start()).rejects.toThrow('Bind failed');

      ServerMock.mockImplementation(originalImpl);
    });

    it('should skip service when not found in proto', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('NonExistentService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());
      await server.start();

      const mockServer = server.getServer() as unknown as { addService: jest.Mock };
      expect(mockServer.addService).not.toHaveBeenCalled();

      await server.close();
    });

    it('should use default url when not provided', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne(data: { id: number }) {
          return { id: data.id, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());
      await server.start();

      const mockServer = (grpc.Server as jest.Mock).mock.results[0]?.value;
      expect(mockServer.bindAsync).toHaveBeenCalledWith(
        '0.0.0.0:50051',
        expect.anything(),
        expect.any(Function)
      );

      await server.close();
    });
  });

  describe('close', () => {
    it('should shutdown server gracefully', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());
      await server.start();

      await server.close();

      expect(server.getServer()).toBeNull();
    });

    it('should do nothing when server is not started', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      await server.close();

      expect(server.getServer()).toBeNull();
    });

    it('should force shutdown when tryShutdown fails', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());
      await server.start();

      const mockServer = server.getServer() as unknown as {
        tryShutdown: jest.Mock;
        forceShutdown: jest.Mock;
      };
      mockServer.tryShutdown.mockImplementation((callback: (err: Error | null) => void) => {
        setImmediate(() => callback(new Error('Shutdown failed')));
      });

      await server.close();

      expect(mockServer.forceShutdown).toHaveBeenCalled();
    });
  });

  describe('handler execution', () => {
    it('should handle async handler that rejects', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        async findOne() {
          throw new Error('Async error');
        }
      }

      server.registerHandlersFromProvider(new TestController());
      await server.start();

      const mockServer = server.getServer() as unknown as { addService: jest.Mock };
      const implementation = mockServer.addService.mock.calls[0][1];
      const callback = jest.fn();
      implementation.FindOne({ request: { id: 1 } }, callback);

      await new Promise((r) => setImmediate(r));

      expect(callback).toHaveBeenCalledWith(expect.any(Error), null);

      await server.close();
    });

    it('should handle sync handler that throws', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          throw new Error('Sync error');
        }
      }

      server.registerHandlersFromProvider(new TestController());
      await server.start();

      const mockServer = server.getServer() as unknown as { addService: jest.Mock };
      const implementation = mockServer.addService.mock.calls[0][1];
      const callback = jest.fn();
      implementation.FindOne({ request: { id: 1 } }, callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error), null);

      await server.close();
    });
  });

  describe('getServer', () => {
    it('should return null before start', () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });
      expect(server.getServer()).toBeNull();
    });

    it('should return server instance after start', async () => {
      const server = new GrpcServer();
      server.configure({ protoPath, package: 'hero' });

      class TestController {
        @GrpcMethod('HeroService', 'FindOne')
        findOne() {
          return { id: 1, name: 'Hero' };
        }
      }

      server.registerHandlersFromProvider(new TestController());
      await server.start();

      expect(server.getServer()).not.toBeNull();

      await server.close();
    });
  });
});
