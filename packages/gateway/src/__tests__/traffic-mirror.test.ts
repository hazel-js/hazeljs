import { TrafficMirror } from '../middleware/traffic-mirror';
import { DiscoveryClient, MemoryRegistryBackend, ServiceStatus } from '@hazeljs/discovery';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TrafficMirror', () => {
  let backend: MemoryRegistryBackend;
  let discoveryClient: DiscoveryClient;

  beforeEach(async () => {
    backend = new MemoryRegistryBackend();
    await backend.register({
      id: 'mirror-1',
      name: 'shadow-service',
      host: 'localhost',
      port: 5000,
      protocol: 'http',
      status: ServiceStatus.UP,
      lastHeartbeat: new Date(),
      registeredAt: new Date(),
    });
    discoveryClient = new DiscoveryClient({ cacheEnabled: false }, backend);

    mockedAxios.create.mockReturnValue({
      request: jest.fn().mockResolvedValue({}),
    } as any);
  });

  afterEach(() => {
    discoveryClient.close();
  });

  it('should mirror request when percentage allows', async () => {
    const mockRequest = jest.fn().mockResolvedValue({});
    mockedAxios.create.mockReturnValue({ request: mockRequest } as any);

    const mirror = new TrafficMirror(
      { service: 'shadow-service', percentage: 100, waitForResponse: true },
      discoveryClient
    );

    await mirror.mirror({
      method: 'GET',
      path: '/api/test',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalled();
  });

  it('should not fail when mirror service has no instances', async () => {
    const mirror = new TrafficMirror(
      { service: 'non-existent-service', percentage: 100 },
      discoveryClient
    );

    await expect(
      mirror.mirror({
        method: 'GET',
        path: '/api/test',
        headers: {},
      })
    ).resolves.not.toThrow();
  });

  it('should include X-Mirror headers when mirroring', async () => {
    const mockRequest = jest.fn().mockResolvedValue({});
    mockedAxios.create.mockReturnValue({ request: mockRequest } as any);

    const mirror = new TrafficMirror(
      { service: 'shadow-service', percentage: 100, waitForResponse: true },
      discoveryClient
    );

    await mirror.mirror({
      method: 'POST',
      path: '/api/test',
      headers: { 'content-type': 'application/json' },
      body: { foo: 'bar' },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Mirror': 'true',
          'X-Mirror-Source': 'hazeljs-gateway',
        }),
      })
    );
  });
});
