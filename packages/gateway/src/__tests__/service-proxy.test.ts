import { ServiceProxy } from '../proxy/service-proxy';
import { DiscoveryClient, MemoryRegistryBackend, ServiceStatus } from '@hazeljs/discovery';
import { RateLimitError } from '@hazeljs/resilience';
import { ProxyRequest } from '../types';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ServiceProxy', () => {
  let backend: MemoryRegistryBackend;
  let discoveryClient: DiscoveryClient;

  beforeEach(async () => {
    backend = new MemoryRegistryBackend();
    await backend.register({
      id: 'svc-1',
      name: 'test-service',
      host: 'localhost',
      port: 4000,
      protocol: 'http',
      status: ServiceStatus.UP,
      lastHeartbeat: new Date(),
      registeredAt: new Date(),
    });
    discoveryClient = new DiscoveryClient({ cacheEnabled: false }, backend);

    const mockRequest = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      data: { ok: true },
    });
    mockedAxios.create.mockReturnValue({ request: mockRequest } as any);
  });

  afterEach(() => {
    discoveryClient.close();
  });

  it('should forward request to discovered instance', async () => {
    const proxy = new ServiceProxy(discoveryClient, { serviceName: 'test-service' });
    const request: ProxyRequest = {
      method: 'GET',
      path: '/items',
      headers: {},
    };

    const response = await proxy.forward(request);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('should throw when no instances available', async () => {
    await backend.deregister('svc-1');
    const proxy = new ServiceProxy(discoveryClient, { serviceName: 'test-service' });

    await expect(proxy.forward({ method: 'GET', path: '/x', headers: {} })).rejects.toThrow(
      'No instances available'
    );
  });

  it('should apply stripPrefix and addPrefix', async () => {
    const mockRequest = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      data: {},
    });
    mockedAxios.create.mockReturnValue({ request: mockRequest } as any);

    const proxy = new ServiceProxy(discoveryClient, {
      serviceName: 'test-service',
      stripPrefix: '/api',
      addPrefix: '/v1',
    });

    await proxy.forward({
      method: 'GET',
      path: '/api/items',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/v1/items',
      })
    );
  });

  it('getMetrics should return MetricsCollector', () => {
    const proxy = new ServiceProxy(discoveryClient, { serviceName: 'test-service' });
    const m = proxy.getMetrics();
    expect(m).toBeDefined();
    expect(m.getSnapshot).toBeDefined();
  });

  it('getServiceName should return service name', () => {
    const proxy = new ServiceProxy(discoveryClient, { serviceName: 'my-service' });
    expect(proxy.getServiceName()).toBe('my-service');
  });

  it('should throw RateLimitError when rate limit exceeded', async () => {
    const proxy = new ServiceProxy(discoveryClient, {
      serviceName: 'test-service',
      rateLimit: { strategy: 'sliding-window', max: 1, window: 60_000 },
    });

    await proxy.forward({ method: 'GET', path: '/x', headers: {} });

    await expect(proxy.forward({ method: 'GET', path: '/x', headers: {} })).rejects.toThrow(
      RateLimitError
    );
    await expect(proxy.forward({ method: 'GET', path: '/x', headers: {} })).rejects.toThrow(
      'Rate limit exceeded'
    );
  });

  it('forwardToVersion should merge filter with version', async () => {
    await backend.register({
      id: 'svc-2',
      name: 'test-service',
      host: 'localhost',
      port: 4001,
      protocol: 'http',
      status: ServiceStatus.UP,
      lastHeartbeat: new Date(),
      registeredAt: new Date(),
      metadata: { version: 'v2' },
    });
    const proxy = new ServiceProxy(discoveryClient, { serviceName: 'test-service' });
    const response = await proxy.forwardToVersion({ method: 'GET', path: '/x', headers: {} }, 'v2');
    expect(response.status).toBe(200);
  });
});
