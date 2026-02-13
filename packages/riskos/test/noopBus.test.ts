/**
 * NoopBus tests
 */

import { NoopBus } from '../src';

describe('NoopBus', () => {
  it('publish does nothing', () => {
    const bus = new NoopBus();
    expect(() => bus.publish({ type: 'metric', name: 'x', value: 1 })).not.toThrow();
  });

  it('subscribe returns no-op unsubscribe', () => {
    const bus = new NoopBus();
    const unsub = bus.subscribe(() => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});
