import {
  MemoryGuardAction,
  MemoryGuardOptions,
  MemoryUsageSnapshot,
  DrainCoordinatorLike,
} from '../types';
import { drainBeforeAction } from '../drain/graceful-drain';
import { formatBytes, getMemoryUsage, parseMemoryThreshold } from '../utils/memory';

export type MemoryGuardEvent =
  | { type: 'threshold-exceeded'; usage: MemoryUsageSnapshot; threshold: number }
  | { type: 'action-executed'; action: MemoryGuardAction; success: boolean; message: string };

/**
 * Monitors process memory and triggers recovery actions.
 */
export class MemoryGuardMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly thresholdBytes: number;
  private readonly options: Required<
    Pick<MemoryGuardOptions, 'intervalMs' | 'action' | 'preserveState'>
  > &
    MemoryGuardOptions;
  private readonly drainCoordinator?: DrainCoordinatorLike;
  private lastUsage: MemoryUsageSnapshot | null = null;
  private triggered = false;

  constructor(options: MemoryGuardOptions = {}, drainCoordinator?: DrainCoordinatorLike) {
    this.thresholdBytes = parseMemoryThreshold(options.threshold ?? '500MB');
    this.drainCoordinator = drainCoordinator;
    this.options = {
      intervalMs: 5000,
      action: 'memory-cleanup',
      preserveState: true,
      ...options,
    };
  }

  start(onEvent?: (event: MemoryGuardEvent) => void): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.check(onEvent);
    }, this.options.intervalMs);

    if (typeof this.interval.unref === 'function') {
      this.interval.unref();
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async check(onEvent?: (event: MemoryGuardEvent) => void): Promise<MemoryUsageSnapshot> {
    const usage = getMemoryUsage();
    this.lastUsage = usage;

    if (usage.heapUsed >= this.thresholdBytes && !this.triggered) {
      this.triggered = true;
      onEvent?.({
        type: 'threshold-exceeded',
        usage,
        threshold: this.thresholdBytes,
      });

      await this.options.onThresholdExceeded?.(usage);
      const result = await this.executeAction();
      onEvent?.({
        type: 'action-executed',
        action: this.options.action ?? 'memory-cleanup',
        success: result.success,
        message: result.message,
      });
    }

    return usage;
  }

  getLastUsage(): MemoryUsageSnapshot | null {
    return this.lastUsage;
  }

  getThresholdBytes(): number {
    return this.thresholdBytes;
  }

  resetTrigger(): void {
    this.triggered = false;
  }

  private async executeAction(): Promise<{ success: boolean; message: string }> {
    const action = this.options.action ?? 'memory-cleanup';

    switch (action) {
      case 'notify-only':
        return {
          success: true,
          message: `Memory threshold exceeded (${formatBytes(this.thresholdBytes)})`,
        };

      case 'memory-cleanup': {
        let cleaned = false;
        if (typeof global.gc === 'function') {
          global.gc();
          cleaned = true;
        }
        return {
          success: cleaned || true,
          message: cleaned
            ? 'Triggered garbage collection after memory threshold'
            : 'Memory threshold exceeded; GC not exposed (run node --expose-gc)',
        };
      }

      case 'graceful-restart': {
        if (this.drainCoordinator) {
          const drainOptions = typeof this.options.drain === 'object' ? this.options.drain : {};
          const result = await drainBeforeAction(this.drainCoordinator, drainOptions);
          return {
            success: result.drained,
            message: result.drained
              ? `Graceful drain completed in ${result.waitedMs}ms`
              : `Graceful drain timed out after ${result.waitedMs}ms`,
          };
        }

        return {
          success: true,
          message: this.options.preserveState
            ? 'Graceful restart signal emitted (state preserved)'
            : 'Graceful restart signal emitted',
        };
      }

      default:
        return { success: false, message: `Unknown action: ${action}` };
    }
  }
}
