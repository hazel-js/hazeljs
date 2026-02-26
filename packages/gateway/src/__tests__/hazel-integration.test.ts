import { createGatewayHandler } from '../hazel-integration';
import { GatewayServer } from '../gateway';
import { MemoryRegistryBackend, ServiceStatus } from '@hazeljs/discovery';
import { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('createGatewayHandler', () => {
  let backend: MemoryRegistryBackend;

  beforeEach(async () => {
    backend = new MemoryRegistryBackend();
    await backend.register({
      id: 'svc-1',
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
        headers: { 'content-type': 'application/json' },
        data: { id: 1, name: 'Alice' },
      }),
    } as any);
  });

  it('should create handler that forwards to gateway and returns true', async () => {
    const gateway = GatewayServer.fromConfig(
      {
        discovery: { cacheEnabled: false },
        routes: [{ path: '/api/users/**', serviceName: 'user-service' }],
      },
      backend
    );

    const handler = createGatewayHandler(gateway);

    const req = {
      method: 'GET',
      url: '/api/users/1',
      headers: { 'content-type': 'application/json' },
    } as IncomingMessage;

    const res = {
      writeHead: jest.fn(),
      end: jest.fn(),
      writableEnded: false,
    } as unknown as ServerResponse;

    const context = {
      method: 'GET',
      url: '/api/users/1',
      headers: {},
      params: {},
      query: {},
      body: undefined,
    };

    const handled = await handler(req, res, context);

    expect(handled).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ id: 1, name: 'Alice' }));
  });

  it('should return 404 response when no route matches', async () => {
    const gateway = GatewayServer.fromConfig(
      {
        discovery: { cacheEnabled: false },
        routes: [{ path: '/api/users/**', serviceName: 'user-service' }],
      },
      backend
    );

    const handler = createGatewayHandler(gateway);

    const req = {
      method: 'GET',
      url: '/unknown/path',
      headers: {},
    } as IncomingMessage;

    const res = {
      writeHead: jest.fn(),
      end: jest.fn(),
      writableEnded: false,
    } as unknown as ServerResponse;

    const context = {
      method: 'GET',
      url: '/unknown/path',
      headers: {},
      params: {},
      query: {},
      body: undefined,
    };

    const handled = await handler(req, res, context);

    expect(handled).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(
      JSON.stringify({ error: 'No matching gateway route', path: '/unknown/path' })
    );
  });
});
