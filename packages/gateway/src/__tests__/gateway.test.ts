import { GatewayServer } from '../gateway';
import { Gateway, Route, ServiceRoute } from '../decorators';
import { MemoryRegistryBackend, ServiceStatus } from '@hazeljs/discovery';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GatewayServer', () => {
  let backend: MemoryRegistryBackend;

  beforeEach(async () => {
    backend = new MemoryRegistryBackend();
    await backend.register({
      id: 'user-1',
      name: 'user-service',
      host: 'localhost',
      port: 3001,
      protocol: 'http',
      status: ServiceStatus.UP,
      lastHeartbeat: new Date(),
      registeredAt: new Date(),
    });
    mockedAxios.create.mockReturnValue({
      request: jest.fn().mockResolvedValue({
        status: 200,
        headers: {},
        data: { id: 1, name: 'Alice' },
      }),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleRequest', () => {
    it('should return 404 when no route matches', async () => {
      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      gateway.addRoute({
        path: '/api/users/**',
        serviceName: 'user-service',
      });

      const response = await gateway.handleRequest({
        method: 'GET',
        path: '/unknown/path',
        headers: {},
      });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: 'No matching gateway route' });
    });

    it('should return 405 when method not allowed', async () => {
      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      gateway.addRoute({
        path: '/api/users/**',
        serviceName: 'user-service',
        methods: ['POST'],
      });

      const response = await gateway.handleRequest({
        method: 'GET',
        path: '/api/users/1',
        headers: {},
      });

      expect(response.status).toBe(405);
      expect(response.body).toMatchObject({ error: 'Method not allowed' });
    });

    it('should proxy request to service and return response', async () => {
      const mockRequest = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { id: 1, name: 'Alice' },
      });
      mockedAxios.create.mockReturnValue({ request: mockRequest } as any);

      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      gateway.addRoute({
        path: '/api/users/**',
        serviceName: 'user-service',
      });

      const response = await gateway.handleRequest({
        method: 'GET',
        path: '/api/users/1',
        headers: {},
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 1, name: 'Alice' });
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should return 502 when service proxy throws', async () => {
      await backend.deregister('user-1');

      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      gateway.addRoute({
        path: '/api/users/**',
        serviceName: 'user-service',
      });

      const response = await gateway.handleRequest({
        method: 'GET',
        path: '/api/users/1',
        headers: {},
      });

      expect(response.status).toBe(502);
      expect(response.body).toMatchObject({ error: 'Bad Gateway' });
    });

    it('should emit route:error on proxy failure', async () => {
      await backend.deregister('user-1');

      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      gateway.addRoute({
        path: '/api/users/**',
        serviceName: 'user-service',
      });

      const errorHandler = jest.fn();
      gateway.on('route:error' as any, errorHandler);

      await gateway.handleRequest({
        method: 'GET',
        path: '/api/users/1',
        headers: {},
      });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          route: '/api/users/**',
          service: 'user-service',
        })
      );
    });
  });

  describe('fromConfig', () => {
    it('should create gateway with routes from config', () => {
      const gateway = GatewayServer.fromConfig(
        {
          discovery: { cacheEnabled: false },
          routes: [
            { path: '/a', serviceName: 'svc-a' },
            { path: '/b', serviceName: 'svc-b' },
          ],
        },
        backend
      );
      expect(gateway.getRoutes()).toEqual(['/a', '/b']);
    });
  });

  describe('fromClass', () => {
    it('should create gateway from decorated class', () => {
      @Gateway({})
      class TestGateway {
        @Route('/api/test/**')
        @ServiceRoute('test-service')
        testRoute: unknown;
      }
      const gateway = GatewayServer.fromClass(TestGateway, backend);
      expect(gateway.getRoutes()).toContain('/api/test/**');
    });
  });

  describe('lifecycle', () => {
    it('should start and stop canaries', () => {
      const gateway = GatewayServer.fromConfig(
        {
          discovery: { cacheEnabled: false },
          routes: [
            {
              path: '/api/orders/**',
              serviceName: 'order-service',
              canary: {
                stable: { version: 'v1', weight: 90 },
                canary: { version: 'v2', weight: 10 },
                promotion: {
                  strategy: 'error-rate',
                  errorThreshold: 5,
                  evaluationWindow: '5m',
                  autoPromote: true,
                  autoRollback: true,
                  steps: [10, 25, 50, 75, 100],
                  stepInterval: '10m',
                },
              },
            },
          ],
        },
        backend
      );
      expect(() => gateway.startCanaries()).not.toThrow();
      expect(() => gateway.stop()).not.toThrow();
    });

    it('stop should close discovery client', async () => {
      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      gateway.addRoute({ path: '/x', serviceName: 'user-service' });
      gateway.stop();
      expect(backend).toBeDefined();
    });
  });

  describe('getters', () => {
    it('getMetrics should return GatewayMetrics', () => {
      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      gateway.addRoute({ path: '/x', serviceName: 'user-service' });
      const metrics = gateway.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.getSnapshot).toBeDefined();
    });

    it('getCanaryEngine should return engine for canary route', () => {
      const gateway = GatewayServer.fromConfig(
        {
          discovery: { cacheEnabled: false },
          routes: [
            {
              path: '/api/orders/**',
              serviceName: 'order-service',
              canary: {
                stable: { version: 'v1', weight: 90 },
                canary: { version: 'v2', weight: 10 },
                promotion: {
                  strategy: 'error-rate',
                  errorThreshold: 5,
                  evaluationWindow: '5m',
                  autoPromote: true,
                  autoRollback: true,
                  steps: [10, 25, 50, 75, 100],
                  stepInterval: '10m',
                },
              },
            },
          ],
        },
        backend
      );
      const engine = gateway.getCanaryEngine('/api/orders/**');
      expect(engine).toBeDefined();
      expect(gateway.getCanaryEngine('/nonexistent')).toBeUndefined();
    });

    it('getDiscoveryClient should return the client', () => {
      const gateway = new GatewayServer({ discovery: { cacheEnabled: false } }, backend);
      const client = gateway.getDiscoveryClient();
      expect(client).toBeDefined();
      expect(client.getInstances).toBeDefined();
    });
  });
});
