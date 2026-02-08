/**
 * Kubernetes Backend Tests
 * Uses mocked @kubernetes/client-node API
 */

import { KubernetesRegistryBackend } from '../backends/kubernetes-backend';
import { ServiceStatus } from '../types';
import { DiscoveryLogger } from '../utils/logger';

// Suppress console logs during tests
beforeAll(() => {
  DiscoveryLogger.setLogger({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

afterAll(() => {
  DiscoveryLogger.resetLogger();
});

// Mock @kubernetes/client-node (optional peer dependency)
jest.mock(
  '@kubernetes/client-node',
  () => ({
    CoreV1Api: class MockCoreV1Api {},
  }),
  { virtual: true }
);

function createMockK8sApi() {
  return {
    readNamespacedEndpoints: jest.fn(),
    listNamespacedService: jest.fn(),
  };
}

function createMockKubeConfig(api: ReturnType<typeof createMockK8sApi>) {
  return {
    makeApiClient: jest.fn(() => api),
  };
}

describe('KubernetesRegistryBackend', () => {
  let k8sApi: ReturnType<typeof createMockK8sApi>;
  let backend: KubernetesRegistryBackend;

  beforeEach(() => {
    k8sApi = createMockK8sApi();
    const kubeConfig = createMockKubeConfig(k8sApi);
    backend = new KubernetesRegistryBackend(kubeConfig);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(backend).toBeDefined();
    });

    it('should accept custom namespace and label selector', () => {
      const api = createMockK8sApi();
      const config = createMockKubeConfig(api);
      const b = new KubernetesRegistryBackend(config, {
        namespace: 'production',
        labelSelector: 'app=myapp',
      });
      expect(b).toBeDefined();
    });
  });

  describe('register / deregister / heartbeat (no-ops)', () => {
    it('register should be a no-op', async () => {
      await expect(
        backend.register({
          id: 'svc-1',
          name: 'test',
          host: 'localhost',
          port: 3000,
          status: ServiceStatus.UP,
          lastHeartbeat: new Date(),
          registeredAt: new Date(),
        })
      ).resolves.not.toThrow();
    });

    it('deregister should be a no-op', async () => {
      await expect(backend.deregister('svc-1')).resolves.not.toThrow();
    });

    it('heartbeat should be a no-op', async () => {
      await expect(backend.heartbeat('svc-1')).resolves.not.toThrow();
    });

    it('updateStatus should be a no-op', async () => {
      await expect(backend.updateStatus('svc-1', ServiceStatus.DOWN)).resolves.not.toThrow();
    });

    it('cleanup should be a no-op', async () => {
      await expect(backend.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getInstances', () => {
    it('should return instances from endpoints', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: {
            annotations: {},
            labels: { app: 'my-service' },
            creationTimestamp: '2025-01-01T00:00:00Z',
          },
          subsets: [
            {
              addresses: [
                { ip: '10.0.0.1', targetRef: { name: 'pod-1' }, nodeName: 'node-1' },
                { ip: '10.0.0.2', targetRef: { name: 'pod-2' }, nodeName: 'node-2' },
              ],
              ports: [{ port: 8080 }],
            },
          ],
        },
      });

      const instances = await backend.getInstances('my-service');

      expect(instances).toHaveLength(2);
      expect(instances[0].id).toBe('my-service:10.0.0.1:8080');
      expect(instances[0].host).toBe('10.0.0.1');
      expect(instances[0].port).toBe(8080);
      expect(instances[0].status).toBe(ServiceStatus.UP);
      expect(instances[0].metadata?.podName).toBe('pod-1');
      expect(instances[0].metadata?.nodeName).toBe('node-1');
    });

    it('should mark notReadyAddresses as STARTING', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: { labels: {} },
          subsets: [
            {
              addresses: [],
              notReadyAddresses: [{ ip: '10.0.0.3' }],
              ports: [{ port: 8080 }],
            },
          ],
        },
      });

      const instances = await backend.getInstances('my-service');
      expect(instances).toHaveLength(1);
      expect(instances[0].status).toBe(ServiceStatus.STARTING);
    });

    it('should handle multiple ports per address', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: { labels: {} },
          subsets: [
            {
              addresses: [{ ip: '10.0.0.1' }],
              ports: [{ port: 8080 }, { port: 8443 }],
            },
          ],
        },
      });

      const instances = await backend.getInstances('my-service');
      expect(instances).toHaveLength(2);
      expect(instances[0].port).toBe(8080);
      expect(instances[1].port).toBe(8443);
    });

    it('should return empty array when no subsets', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: {},
        },
      });

      const instances = await backend.getInstances('my-service');
      expect(instances).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      k8sApi.readNamespacedEndpoints.mockRejectedValueOnce(new Error('Not found'));

      const instances = await backend.getInstances('non-existent');
      expect(instances).toEqual([]);
    });

    it('should apply filters', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: {
            labels: {
              'topology.kubernetes.io/zone': 'us-east-1a',
            },
          },
          subsets: [
            {
              addresses: [{ ip: '10.0.0.1' }, { ip: '10.0.0.2' }],
              ports: [{ port: 8080 }],
            },
          ],
        },
      });

      const instances = await backend.getInstances('my-service', {
        status: ServiceStatus.UP,
      });
      expect(instances).toHaveLength(2);
    });

    it('should extract zone from labels', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: {
            labels: {
              'topology.kubernetes.io/zone': 'us-west-2a',
            },
          },
          subsets: [
            {
              addresses: [{ ip: '10.0.0.1' }],
              ports: [{ port: 8080 }],
            },
          ],
        },
      });

      const instances = await backend.getInstances('my-service');
      expect(instances[0].zone).toBe('us-west-2a');
    });
  });

  describe('getInstance', () => {
    it('should find instance by ID', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: { labels: {} },
          subsets: [
            {
              addresses: [{ ip: '10.0.0.1' }, { ip: '10.0.0.2' }],
              ports: [{ port: 8080 }],
            },
          ],
        },
      });

      const instance = await backend.getInstance('my-service:10.0.0.2:8080');
      expect(instance).toBeDefined();
      expect(instance!.host).toBe('10.0.0.2');
    });

    it('should return null for non-existent instance', async () => {
      k8sApi.readNamespacedEndpoints.mockResolvedValueOnce({
        body: {
          metadata: { labels: {} },
          subsets: [
            {
              addresses: [{ ip: '10.0.0.1' }],
              ports: [{ port: 8080 }],
            },
          ],
        },
      });

      const instance = await backend.getInstance('my-service:10.0.0.99:8080');
      expect(instance).toBeNull();
    });
  });

  describe('getAllServices', () => {
    it('should return service names from namespace', async () => {
      k8sApi.listNamespacedService.mockResolvedValueOnce({
        body: {
          items: [{ metadata: { name: 'svc-a' } }, { metadata: { name: 'svc-b' } }],
        },
      });

      const services = await backend.getAllServices();
      expect(services).toEqual(['svc-a', 'svc-b']);
    });

    it('should return empty array on error', async () => {
      k8sApi.listNamespacedService.mockRejectedValueOnce(new Error('Forbidden'));

      const services = await backend.getAllServices();
      expect(services).toEqual([]);
    });

    it('should handle missing metadata', async () => {
      k8sApi.listNamespacedService.mockResolvedValueOnce({
        body: {
          items: [{ metadata: {} }, {}],
        },
      });

      const services = await backend.getAllServices();
      expect(services).toEqual(['', '']);
    });
  });
});
