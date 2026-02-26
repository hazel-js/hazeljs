import { describe, it, expect } from 'vitest';
import { createServiceRegistry } from '../src/services/ServiceRegistry.js';

describe('createServiceRegistry', () => {
  it('returns registry with logger', () => {
    const registry = createServiceRegistry();
    expect(registry.logger).toBeDefined();
    expect(typeof registry.logger.info).toBe('function');
    expect(typeof registry.logger.error).toBe('function');
    expect(typeof registry.logger.debug).toBe('function');
  });

  it('logger methods do not throw', () => {
    const registry = createServiceRegistry();
    expect(() => registry.logger.info('test')).not.toThrow();
    expect(() => registry.logger.error('test')).not.toThrow();
    expect(() => registry.logger.debug('test')).not.toThrow();
  });
});
