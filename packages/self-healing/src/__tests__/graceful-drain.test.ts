import { createGracefulDrainCoordinator } from '../drain/graceful-drain';

describe('GracefulDrainCoordinator', () => {
  it('waits for in-flight work to complete', async () => {
    const drain = createGracefulDrainCoordinator({ timeoutMs: 1000, pollIntervalMs: 20 });
    let released = false;

    const work = drain.track(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      released = true;
    });

    const draining = drain.drain();
    await work;
    const result = await draining;

    expect(result.drained).toBe(true);
    expect(released).toBe(true);
    expect(drain.isReady()).toBe(false);
  });

  it('rejects new work while draining', async () => {
    const drain = createGracefulDrainCoordinator();
    void drain.drain({ timeoutMs: 500 });

    await expect(drain.track(async () => 'ok')).rejects.toThrow(/draining/i);
  });
});
