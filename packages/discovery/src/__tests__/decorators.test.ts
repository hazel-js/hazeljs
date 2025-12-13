/**
 * Decorators Tests
 */

import 'reflect-metadata';
import {
  ServiceRegistry,
  getServiceRegistryMetadata,
} from '../decorators/service-registry.decorator';
import {
  InjectServiceClient,
  getInjectServiceClientMetadata,
} from '../decorators/inject-service-client.decorator';
import { ServiceRegistryConfig } from '../types';

describe('Decorators', () => {
  describe('ServiceRegistry', () => {
    it('should attach metadata to class', () => {
      const config: ServiceRegistryConfig = {
        name: 'test-service',
        port: 3000,
        zone: 'us-east-1',
      };

      @ServiceRegistry(config)
      class TestService {}

      const metadata = getServiceRegistryMetadata(TestService);
      expect(metadata).toEqual(config);
    });

    it('should return undefined for class without decorator', () => {
      class TestService {}

      const metadata = getServiceRegistryMetadata(TestService);
      expect(metadata).toBeUndefined();
    });
  });

  describe('InjectServiceClient', () => {
    it('should attach metadata to parameter', () => {
      class TestService {
        constructor(
          @InjectServiceClient('user-service')
          _userClient: unknown,
          @InjectServiceClient('order-service', { timeout: 5000 })
          _orderClient: unknown
        ) {}
      }

      const metadata = getInjectServiceClientMetadata(TestService);
      expect(metadata).toBeDefined();
      expect(metadata?.[0]).toEqual({
        serviceName: 'user-service',
      });
      expect(metadata?.[1]).toEqual({
        serviceName: 'order-service',
        timeout: 5000,
      });
    });

    it('should return undefined for class without decorator', () => {
      class TestService {
        constructor(_client: unknown) {}
      }

      const metadata = getInjectServiceClientMetadata(TestService);
      expect(metadata).toBeUndefined();
    });
  });
});

