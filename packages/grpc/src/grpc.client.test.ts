import 'reflect-metadata';
import path from 'path';
import * as grpc from '@grpc/grpc-js';
import { GrpcClientService } from './grpc.client';

const mockStub = {
  FindOne: jest.fn(),
};

jest.mock('@grpc/grpc-js', () => {
  const actual = jest.requireActual('@grpc/grpc-js');
  return {
    ...actual,
    loadPackageDefinition: jest.fn((_pkgDef: unknown) => {
      return {
        hero: {
          HeroService: jest.fn().mockImplementation(() => mockStub),
        },
      };
    }),
  };
});

describe('GrpcClientService', () => {
  let client: GrpcClientService;
  const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');

  beforeEach(() => {
    client = new GrpcClientService();
    jest.clearAllMocks();
  });

  describe('configure', () => {
    it('should load proto and set options', () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      expect(grpc.loadPackageDefinition).toHaveBeenCalled();
    });

    it('should accept array of proto paths', () => {
      client.configure({
        protoPath: [protoPath],
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      expect(grpc.loadPackageDefinition).toHaveBeenCalled();
    });
  });

  describe('getClient', () => {
    it('should throw when not configured', () => {
      expect(() => client.getClient('HeroService')).toThrow(
        'GrpcClientService not configured. Use GrpcClientModule.forRoot() first.'
      );
    });

    it('should return stub for configured service', () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      const stub = client.getClient('HeroService');
      expect(stub).toBeDefined();
      expect(stub.FindOne).toBeDefined();
    });

    it('should use defaultUrl when url not passed', () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50052',
      });

      const stub = client.getClient('HeroService');
      expect(stub).toBe(mockStub);
    });

    it('should use passed url when provided', () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      const stub = client.getClient('HeroService', 'localhost:50053');
      expect(stub).toBe(mockStub);
    });

    it('should throw when package not found in proto', () => {
      (grpc.loadPackageDefinition as jest.Mock).mockReturnValueOnce({});
      client.configure({
        protoPath,
        package: 'nonexistent',
        defaultUrl: 'localhost:50051',
      });

      expect(() => client.getClient('HeroService')).toThrow(
        'Package "nonexistent" not found in proto descriptor'
      );
    });

    it('should throw when service not found in package', () => {
      (grpc.loadPackageDefinition as jest.Mock).mockReturnValueOnce({
        hero: {},
      });
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      expect(() => client.getClient('NonExistentService')).toThrow(
        'Service "NonExistentService" not found in package "hero"'
      );
    });

    it('should throw when no defaultUrl and url not passed', () => {
      client.configure({
        protoPath,
        package: 'hero',
      });

      expect(() => client.getClient('HeroService')).toThrow(
        'No URL provided. Pass url to getClient() or set defaultUrl in GrpcClientModule.forRoot()'
      );
    });

    it('should cache stubs per service and url', () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      const stub1 = client.getClient('HeroService');
      const stub2 = client.getClient('HeroService');
      expect(stub1).toBe(stub2);
    });
  });

  describe('getClientAsync', () => {
    it('should resolve with stub when using defaultUrl', async () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      const stub = await client.getClientAsync('HeroService');
      expect(stub).toBeDefined();
      expect(stub.FindOne).toBeDefined();
    });

    it('should resolve with stub when url passed', async () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      const stub = await client.getClientAsync('HeroService', 'localhost:50052');
      expect(stub).toBe(mockStub);
    });

    it('should use Discovery when configured', async () => {
      const mockInstance = { host: '127.0.0.1', port: 50051 };
      client.configure({
        protoPath,
        package: 'hero',
        discovery: {
          client: {
            getInstance: jest.fn().mockResolvedValue(mockInstance),
          },
          serviceName: 'hero-service',
        },
      });

      const stub = await client.getClientAsync('HeroService');
      expect(stub).toBe(mockStub);
    });

    it('should throw when Discovery returns null', async () => {
      client.configure({
        protoPath,
        package: 'hero',
        discovery: {
          client: {
            getInstance: jest.fn().mockResolvedValue(null),
          },
          serviceName: 'hero-service',
        },
      });

      await expect(client.getClientAsync('HeroService')).rejects.toThrow(
        'Discovery: no gRPC instance found for service "hero-service"'
      );
    });
  });

  describe('close', () => {
    it('should clear state', () => {
      client.configure({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });
      client.getClient('HeroService');

      client.close();

      expect(() => client.getClient('HeroService')).toThrow('GrpcClientService not configured');
    });
  });
});
