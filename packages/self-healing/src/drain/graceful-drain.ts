import { DrainCoordinatorLike, DrainOptions } from '../types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tracks in-flight work and coordinates graceful shutdown before restarts.
 */
export class GracefulDrainCoordinator implements DrainCoordinatorLike {
  private draining = false;
  private ready = true;
  private inflight = 0;
  private readonly defaultOptions: DrainOptions;

  constructor(defaultOptions: DrainOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  isDraining(): boolean {
    return this.draining;
  }

  isReady(): boolean {
    return this.ready;
  }

  getInflightCount(): number {
    return this.inflight;
  }

  track<T>(fn: () => Promise<T>): Promise<T> {
    if (this.draining) {
      return Promise.reject(new Error('Service is draining — rejecting new work'));
    }

    this.inflight += 1;
    return fn().finally(() => {
      this.inflight -= 1;
    });
  }

  async drain(overrideOptions: DrainOptions = {}): Promise<{ drained: boolean; waitedMs: number }> {
    const options = { ...this.defaultOptions, ...overrideOptions };
    const timeoutMs = options.timeoutMs ?? 30000;
    const pollIntervalMs = options.pollIntervalMs ?? 250;
    const startedAt = Date.now();

    this.draining = true;
    this.ready = false;

    await options.onDrainStart?.();
    await options.onReadyChange?.(false);

    while (Date.now() - startedAt < timeoutMs) {
      const inflight = options.getInflightCount?.() ?? this.inflight;
      if (inflight <= 0) {
        return { drained: true, waitedMs: Date.now() - startedAt };
      }
      await sleep(pollIntervalMs);
    }

    return { drained: false, waitedMs: Date.now() - startedAt };
  }

  markReady(ready: boolean): void {
    this.ready = ready;
  }
}

export function createGracefulDrainCoordinator(options?: DrainOptions): GracefulDrainCoordinator {
  return new GracefulDrainCoordinator(options);
}

export async function drainBeforeAction(
  drain: DrainCoordinatorLike | undefined,
  options: DrainOptions | boolean | undefined,
  onNotify?: (payload: Record<string, unknown>) => void
): Promise<{ skipped: boolean; drained: boolean; waitedMs: number }> {
  if (!drain || options === false) {
    return { skipped: true, drained: true, waitedMs: 0 };
  }

  const drainOptions = typeof options === 'object' ? options : {};
  const result = await drain.drain(drainOptions);
  onNotify?.({ drained: result.drained, waitedMs: result.waitedMs });

  return { skipped: false, ...result };
}
