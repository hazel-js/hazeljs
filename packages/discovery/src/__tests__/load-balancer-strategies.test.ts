/**
 * Load Balancer Strategies Tests
 */

import {
  RoundRobinStrategy,
  RandomStrategy,
  LeastConnectionsStrategy,
  WeightedRoundRobinStrategy,
  IPHashStrategy,
  ZoneAwareStrategy,
  LoadBalancerFactory,
} from '../load-balancer/strategies';
import { ServiceInstance, ServiceStatus } from '../types';

describe('Load Balancer Strategies', () => {
  const createInstance = (
    id: string,
    status: ServiceStatus = ServiceStatus.UP
  ): ServiceInstance => ({
    id,
    name: 'test-service',
    host: 'localhost',
    port: 3000,
    status,
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
  });

  describe('RoundRobinStrategy', () => {
    it('should cycle through instances in order', () => {
      const strategy = new RoundRobinStrategy();
      const instances = [createInstance('1'), createInstance('2'), createInstance('3')];

      expect(strategy.choose(instances)?.id).toBe('1');
      expect(strategy.choose(instances)?.id).toBe('2');
      expect(strategy.choose(instances)?.id).toBe('3');
      expect(strategy.choose(instances)?.id).toBe('1'); // Cycles back
    });

    it('should return null when no healthy instances', () => {
      const strategy = new RoundRobinStrategy();
      const instances = [
        createInstance('1', ServiceStatus.DOWN),
        createInstance('2', ServiceStatus.DOWN),
      ];

      expect(strategy.choose(instances)).toBeNull();
    });

    it('should filter out unhealthy instances', () => {
      const strategy = new RoundRobinStrategy();
      const instances = [
        createInstance('1', ServiceStatus.UP),
        createInstance('2', ServiceStatus.DOWN),
        createInstance('3', ServiceStatus.UP),
      ];

      const first = strategy.choose(instances);
      const second = strategy.choose(instances);
      expect([first?.id, second?.id]).toEqual(['1', '3']);
    });
  });

  describe('RandomStrategy', () => {
    it('should return a random instance', () => {
      const strategy = new RandomStrategy();
      const instances = [createInstance('1'), createInstance('2'), createInstance('3')];

      const selected = strategy.choose(instances);
      expect(selected).toBeDefined();
      expect(['1', '2', '3']).toContain(selected?.id);
    });

    it('should return null when no healthy instances', () => {
      const strategy = new RandomStrategy();
      const instances = [
        createInstance('1', ServiceStatus.DOWN),
        createInstance('2', ServiceStatus.DOWN),
      ];

      expect(strategy.choose(instances)).toBeNull();
    });
  });

  describe('LeastConnectionsStrategy', () => {
    it('should select instance with least connections', () => {
      const strategy = new LeastConnectionsStrategy();
      const instances = [createInstance('1'), createInstance('2'), createInstance('3')];

      strategy.incrementConnections('1');
      strategy.incrementConnections('1');
      strategy.incrementConnections('2');

      const selected = strategy.choose(instances);
      expect(selected?.id).toBe('3');
    });

    it('should handle connection increments and decrements', () => {
      const strategy = new LeastConnectionsStrategy();
      const instances = [createInstance('1')];

      strategy.incrementConnections('1');
      strategy.incrementConnections('1');
      expect(strategy.choose(instances)?.id).toBe('1');

      strategy.decrementConnections('1');
      strategy.decrementConnections('1');
      expect(strategy.choose(instances)?.id).toBe('1');
    });

    it('should not allow negative connections', () => {
      const strategy = new LeastConnectionsStrategy();
      const instances = [createInstance('1')];

      strategy.decrementConnections('1');
      strategy.decrementConnections('1');
      expect(strategy.choose(instances)?.id).toBe('1');
    });

    it('should return null when no healthy instances', () => {
      const strategy = new LeastConnectionsStrategy();
      const instances = [
        createInstance('1', ServiceStatus.DOWN),
        createInstance('2', ServiceStatus.DOWN),
      ];

      expect(strategy.choose(instances)).toBeNull();
    });
  });

  describe('WeightedRoundRobinStrategy', () => {
    it('should select instances based on weight', () => {
      const strategy = new WeightedRoundRobinStrategy();
      const instances = [
        { ...createInstance('1'), metadata: { weight: 2 } },
        { ...createInstance('2'), metadata: { weight: 1 } },
      ];

      const results: string[] = [];
      for (let i = 0; i < 6; i++) {
        const selected = strategy.choose(instances);
        if (selected) results.push(selected.id);
      }

      // Should have more '1' than '2' due to weight
      const count1 = results.filter((id) => id === '1').length;
      const count2 = results.filter((id) => id === '2').length;
      expect(count1).toBeGreaterThan(count2);
    });

    it('should default to weight 1 when weight is missing', () => {
      const strategy = new WeightedRoundRobinStrategy();
      const instances = [createInstance('1'), createInstance('2')];

      const selected = strategy.choose(instances);
      expect(selected).toBeDefined();
    });

    it('should handle invalid weight values', () => {
      const strategy = new WeightedRoundRobinStrategy();
      const instances = [
        { ...createInstance('1'), metadata: { weight: 'invalid' } },
        { ...createInstance('2'), metadata: { weight: -1 } },
      ];

      const selected = strategy.choose(instances);
      expect(selected).toBeDefined();
    });

    it('should return null when no healthy instances', () => {
      const strategy = new WeightedRoundRobinStrategy();
      const instances = [
        createInstance('1', ServiceStatus.DOWN),
        createInstance('2', ServiceStatus.DOWN),
      ];

      expect(strategy.choose(instances)).toBeNull();
    });
  });

  describe('IPHashStrategy', () => {
    it('should return same instance for same IP', () => {
      const strategy = new IPHashStrategy();
      const instances = [createInstance('1'), createInstance('2'), createInstance('3')];

      const ip = '192.168.1.1';
      const first = strategy.choose(instances, ip);
      const second = strategy.choose(instances, ip);
      expect(first?.id).toBe(second?.id);
    });

    it('should return first instance when no IP provided', () => {
      const strategy = new IPHashStrategy();
      const instances = [createInstance('1'), createInstance('2')];

      const selected = strategy.choose(instances);
      expect(selected?.id).toBe('1');
    });

    it('should return null when no healthy instances', () => {
      const strategy = new IPHashStrategy();
      const instances = [
        createInstance('1', ServiceStatus.DOWN),
        createInstance('2', ServiceStatus.DOWN),
      ];

      expect(strategy.choose(instances, '192.168.1.1')).toBeNull();
    });
  });

  describe('ZoneAwareStrategy', () => {
    it('should prefer instances in preferred zone', () => {
      const strategy = new ZoneAwareStrategy('us-east-1');
      const instances = [
        { ...createInstance('1'), zone: 'us-east-1' },
        { ...createInstance('2'), zone: 'us-west-1' },
        { ...createInstance('3'), zone: 'us-east-1' },
      ];

      const selected = strategy.choose(instances);
      expect(selected?.zone).toBe('us-east-1');
      expect(['1', '3']).toContain(selected?.id);
    });

    it('should fallback to any zone when preferred zone not available', () => {
      const strategy = new ZoneAwareStrategy('us-east-1');
      const instances = [
        { ...createInstance('1'), zone: 'us-west-1' },
        { ...createInstance('2'), zone: 'eu-west-1' },
      ];

      const selected = strategy.choose(instances);
      expect(selected).toBeDefined();
      expect(['1', '2']).toContain(selected?.id);
    });

    it('should work without preferred zone', () => {
      const strategy = new ZoneAwareStrategy();
      const instances = [createInstance('1'), createInstance('2')];

      const selected = strategy.choose(instances);
      expect(selected).toBeDefined();
    });

    it('should return null when no healthy instances', () => {
      const strategy = new ZoneAwareStrategy('us-east-1');
      const instances = [
        createInstance('1', ServiceStatus.DOWN),
        createInstance('2', ServiceStatus.DOWN),
      ];

      expect(strategy.choose(instances)).toBeNull();
    });
  });

  describe('LoadBalancerFactory', () => {
    it('should register and retrieve strategies', () => {
      const factory = new LoadBalancerFactory();
      const customStrategy = new RoundRobinStrategy();
      customStrategy.name = 'custom';

      factory.register(customStrategy);
      expect(factory.get('custom')).toBe(customStrategy);
    });

    it('should create default strategies', () => {
      const factory = new LoadBalancerFactory();

      expect(factory.get('round-robin')).toBeDefined();
      expect(factory.get('random')).toBeDefined();
      expect(factory.get('least-connections')).toBeDefined();
      expect(factory.get('weighted-round-robin')).toBeDefined();
      expect(factory.get('ip-hash')).toBeDefined();
    });

    it('should create zone-aware strategy with options', () => {
      const factory = new LoadBalancerFactory();
      const strategy = factory.create('zone-aware', { zone: 'us-east-1' });

      expect(strategy).toBeInstanceOf(ZoneAwareStrategy);
      expect(strategy.name).toBe('zone-aware');
    });

    it('should throw error for unknown strategy', () => {
      const factory = new LoadBalancerFactory();

      expect(() => factory.create('unknown-strategy')).toThrow(
        "Load balancing strategy 'unknown-strategy' not found"
      );
    });

    it('should return undefined for non-existent strategy', () => {
      const factory = new LoadBalancerFactory();

      expect(factory.get('non-existent')).toBeUndefined();
    });
  });
});
