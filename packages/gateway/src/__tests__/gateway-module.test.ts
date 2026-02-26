import { GatewayModule } from '../gateway.module';
import { GatewayFullConfig } from '../types';

describe('GatewayModule', () => {
  const sampleConfig: GatewayFullConfig = {
    discovery: { cacheEnabled: true },
    routes: [
      {
        path: '/api/users/**',
        serviceName: 'user-service',
      },
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
  };

  describe('forRoot', () => {
    it('should store options with default configKey', () => {
      GatewayModule.forRoot({});
      const opts = GatewayModule.getOptions();
      expect(opts.configKey).toBe('gateway');
    });

    it('should allow custom configKey', () => {
      GatewayModule.forRoot({ configKey: 'myGateway' });
      const opts = GatewayModule.getOptions();
      expect(opts.configKey).toBe('myGateway');
    });

    it('should accept direct config', () => {
      GatewayModule.forRoot({ config: sampleConfig });
      const opts = GatewayModule.getOptions();
      expect(opts.config).toBe(sampleConfig);
    });
  });

  describe('resolveConfig', () => {
    it('should return direct config when provided', () => {
      GatewayModule.forRoot({ config: sampleConfig });
      const resolved = GatewayModule.resolveConfig();
      expect(resolved).toBe(sampleConfig);
      expect(resolved.routes).toHaveLength(2);
    });

    it('should read from configService when no direct config', () => {
      GatewayModule.forRoot({ configKey: 'gateway' });

      const mockConfigService = {
        get: <T>(key: string): T | undefined => {
          if (key === 'gateway') return sampleConfig as unknown as T;
          return undefined;
        },
      };

      const resolved = GatewayModule.resolveConfig(mockConfigService);
      expect(resolved.routes).toHaveLength(2);
      expect(resolved.routes[0].serviceName).toBe('user-service');
    });

    it('should throw when no config and no configService', () => {
      GatewayModule.forRoot({ configKey: 'gateway' });
      expect(() => GatewayModule.resolveConfig()).toThrow('No config provided');
    });

    it('should throw when configService returns undefined', () => {
      GatewayModule.forRoot({ configKey: 'missing' });

      const mockConfigService = {
        get: <T>(_key: string): T | undefined => undefined,
      };

      expect(() => GatewayModule.resolveConfig(mockConfigService)).toThrow(
        'No configuration found at key "missing"'
      );
    });

    it('should throw when config has no routes array', () => {
      GatewayModule.forRoot({ configKey: 'gateway' });

      const mockConfigService = {
        get: <T>(key: string): T | undefined => {
          if (key === 'gateway') return { discovery: {} } as unknown as T;
          return undefined;
        },
      };

      expect(() => GatewayModule.resolveConfig(mockConfigService)).toThrow(
        'missing a "routes" array'
      );
    });
  });
});
