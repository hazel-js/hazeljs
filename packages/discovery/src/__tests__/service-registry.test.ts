/**
 * Service Registry Tests
 */

import axios from 'axios';
import { ServiceRegistry } from '../registry/service-registry';
import { MemoryRegistryBackend } from '../backends/memory-backend';
import { ServiceStatus } from '../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;
  let backend: MemoryRegistryBackend;

  beforeEach(() => {
    mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    backend = new MemoryRegistryBackend();
    registry = new ServiceRegistry(
      {
        name: 'test-service',
        port: 3000,
        host: 'localhost',
        healthCheckPath: '/health',
        metadata: { version: '1.0.0' },
        zone: 'us-east-1',
        tags: ['test'],
      },
      backend
    );
  });

  afterEach(async () => {
    await registry.deregister();
  });

  describe('register', () => {
    it('should register a service instance', async () => {
      await registry.register();

      const instance = registry.getInstance();
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('test-service');
      expect(instance?.port).toBe(3000);
      expect(instance?.zone).toBe('us-east-1');
    });

    it('should set status to DOWN when health check fails', async () => {
      await registry.register();

      const instance = registry.getInstance();
      expect(instance?.status).toBe(ServiceStatus.DOWN);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should set status to UP when health check succeeds', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

      await registry.register();

      expect(registry.getInstance()?.status).toBe(ServiceStatus.UP);
    });
  });

  describe('deregister', () => {
    it('should deregister a service instance', async () => {
      await registry.register();
      const instanceId = registry.getInstance()?.id;

      await registry.deregister();

      const instance = await backend.getInstance(instanceId!);
      expect(instance).toBeNull();
    });
  });

  describe('getInstance', () => {
    it('should return the registered instance', async () => {
      await registry.register();

      const instance = registry.getInstance();
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('test-service');
    });

    it('should return null before registration', () => {
      const instance = registry.getInstance();
      expect(instance).toBeNull();
    });
  });
});
