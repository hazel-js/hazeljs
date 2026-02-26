/**
 * Timeout
 * Promise-based timeout wrapper with cancellation support.
 */

import { TimeoutConfig, TimeoutError } from '../types';

export class Timeout {
  private durationMs: number;
  private message: string;

  constructor(config: TimeoutConfig | number) {
    if (typeof config === 'number') {
      this.durationMs = config;
      this.message = 'Operation timed out';
    } else {
      this.durationMs = config.duration;
      this.message = config.message || 'Operation timed out';
    }
  }

  /**
   * Execute a function with a timeout
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new TimeoutError(`${this.message} (after ${this.durationMs}ms)`));
      }, this.durationMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Get the configured duration
   */
  getDuration(): number {
    return this.durationMs;
  }
}

/**
 * Convenience function to wrap a promise with a timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  durationMs: number,
  message?: string
): Promise<T> {
  const timeout = new Timeout({ duration: durationMs, message });
  return timeout.execute(fn);
}
