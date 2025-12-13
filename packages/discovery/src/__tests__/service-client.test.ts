/**
 * Service Client Tests
 */

import { ServiceClient } from '../client/service-client';
import { DiscoveryClient } from '../client/discovery-client';
import { MemoryRegistryBackend } from '../backends/memory-backend';
import { ServiceInstance, ServiceStatus } from '../types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ServiceClient', () => {
  let serviceClient: ServiceClient;
  let discoveryClient: DiscoveryClient;
  let backend: MemoryRegistryBackend;

  beforeEach(() => {
    backend = new MemoryRegistryBackend();
    discoveryClient = new DiscoveryClient({}, backend);
    serviceClient = new ServiceClient(discoveryClient, {
      serviceName: 'test-service',
      timeout: 5000,
      retries: 3,
      retryDelay: 100,
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  const createInstance = (id: string): ServiceInstance => ({
    id,
    name: 'test-service',
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    status: ServiceStatus.UP,
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
  });

  describe('GET requests', () => {
    it('should make GET request to discovered service', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const mockResponse = { data: { message: 'success' }, status: 200 };
      mockedAxios.create.mockReturnValue({
        request: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const client = new ServiceClient(discoveryClient, {
        serviceName: 'test-service',
      });

      // Mock the axios instance request method
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);
      (client as any).axiosInstance = { request: mockRequest };

      await client.get('/api/users');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/users',
        })
      );
    });
  });

  describe('POST requests', () => {
    it('should make POST request with data', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const mockResponse = { data: { id: 1 }, status: 201 };
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);
      (serviceClient as any).axiosInstance = { request: mockRequest };

      await serviceClient.post('/api/users', { name: 'John' });
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/users',
          data: { name: 'John' },
        })
      );
    });
  });

  describe('PUT requests', () => {
    it('should make PUT request with data', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const mockResponse = { data: { updated: true }, status: 200 };
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);
      (serviceClient as any).axiosInstance = { request: mockRequest };

      await serviceClient.put('/api/users/1', { name: 'Jane' });
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/api/users/1',
          data: { name: 'Jane' },
        })
      );
    });
  });

  describe('DELETE requests', () => {
    it('should make DELETE request', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const mockResponse = { data: {}, status: 204 };
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);
      (serviceClient as any).axiosInstance = { request: mockRequest };

      await serviceClient.delete('/api/users/1');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/api/users/1',
        })
      );
    });
  });

  describe('PATCH requests', () => {
    it('should make PATCH request with data', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const mockResponse = { data: { patched: true }, status: 200 };
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);
      (serviceClient as any).axiosInstance = { request: mockRequest };

      await serviceClient.patch('/api/users/1', { name: 'Updated' });
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          url: '/api/users/1',
          data: { name: 'Updated' },
        })
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const mockRequest = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ data: { success: true }, status: 200 });

      (serviceClient as any).axiosInstance = { request: mockRequest };

      await serviceClient.get('/api/users');
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const mockRequest = jest.fn().mockRejectedValue(new Error('Network error'));
      (serviceClient as any).axiosInstance = { request: mockRequest };

      await expect(serviceClient.get('/api/users')).rejects.toThrow();
      expect(mockRequest).toHaveBeenCalledTimes(3); // Default retries
    });

    it('should respect retry delay', async () => {
      const client = new ServiceClient(discoveryClient, {
        serviceName: 'test-service',
        retries: 2,
        retryDelay: 50,
      });

      const instance = createInstance('1');
      await backend.register(instance);

      const mockRequest = jest
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValue({ data: {}, status: 200 });

      (client as any).axiosInstance = { request: mockRequest };

      const start = Date.now();
      await client.get('/api/users');
      const duration = Date.now() - start;

      // Should have waited at least 50ms for retry
      expect(duration).toBeGreaterThanOrEqual(40); // Allow some margin
    });
  });

  describe('service discovery integration', () => {
    it('should use discovered service instance', async () => {
      const instance1 = createInstance('1');
      const instance2 = createInstance('2');
      await backend.register(instance1);
      await backend.register(instance2);

      const mockRequest = jest.fn().mockResolvedValue({ data: {}, status: 200 });
      (serviceClient as any).axiosInstance = { request: mockRequest };

      await serviceClient.get('/api/users');

      // Should have used one of the instances
      const call = mockRequest.mock.calls[0][0];
      expect(call.baseURL).toMatch(/http:\/\/localhost:3000/);
    });

    it('should throw error when no instances available', async () => {
      const mockRequest = jest.fn();
      (serviceClient as any).axiosInstance = { request: mockRequest };

      await expect(serviceClient.get('/api/users')).rejects.toThrow(
        'No instances available for service: test-service'
      );
    });
  });

  describe('load balancing strategy', () => {
    it('should use specified load balancing strategy', async () => {
      const instance1 = createInstance('1');
      const instance2 = createInstance('2');
      await backend.register(instance1);
      await backend.register(instance2);

      const client = new ServiceClient(discoveryClient, {
        serviceName: 'test-service',
        loadBalancingStrategy: 'random',
      });

      const mockRequest = jest.fn().mockResolvedValue({ data: {}, status: 200 });
      (client as any).axiosInstance = { request: mockRequest };

      await client.get('/api/users');
      expect(mockRequest).toHaveBeenCalled();
    });
  });

  describe('filters', () => {
    it('should apply service filters', async () => {
      const instance1 = { ...createInstance('1'), zone: 'us-east-1' };
      const instance2 = { ...createInstance('2'), zone: 'us-west-1' };
      await backend.register(instance1);
      await backend.register(instance2);

      const client = new ServiceClient(discoveryClient, {
        serviceName: 'test-service',
        filter: { zone: 'us-east-1' },
      });

      const mockRequest = jest.fn().mockResolvedValue({ data: {}, status: 200 });
      (client as any).axiosInstance = { request: mockRequest };

      await client.get('/api/users');
      expect(mockRequest).toHaveBeenCalled();
    });
  });
});

