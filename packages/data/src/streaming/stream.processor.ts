import { ETLService } from '../pipelines/etl.service';
import logger from '@hazeljs/core';

export interface WindowedBatch<T> {
  items: T[];
  windowStart: number;
  windowEnd: number;
}

/**
 * Stream Processor — in-process stream processing.
 *
 * Features:
 * - `processItem` / `processStream` — single-item and async-generator streaming
 * - `tumblingWindow` — non-overlapping time windows
 * - `slidingWindow` — overlapping time windows
 * - `sessionWindow` — gap-based grouping (items grouped when gap > idleMs)
 * - `joinStreams` — merge two async iterables by matching key
 */
export class StreamProcessor {
  constructor(private readonly etlService: ETLService) {}

  async processItem<T>(pipelineInstance: object, item: unknown): Promise<T> {
    return this.etlService.execute<T>(pipelineInstance, item);
  }

  async *processStream<T>(
    pipelineInstance: object,
    source: AsyncIterable<unknown>
  ): AsyncGenerator<T> {
    for await (const item of source) {
      try {
        yield await this.processItem<T>(pipelineInstance, item);
      } catch (error) {
        logger.error('Stream processor error:', error);
        throw error;
      }
    }
  }

  // ─── Windowing ─────────────────────────────────────────────────────────────

  /**
   * Tumbling window — collects items into non-overlapping fixed-size time windows.
   * Each item is assigned to exactly one window.
   *
   * @param source    Async iterable of `{ value: T; timestamp: number }` items
   * @param windowMs  Window duration in milliseconds
   */
  async *tumblingWindow<T>(
    source: AsyncIterable<{ value: T; timestamp: number }>,
    windowMs: number
  ): AsyncGenerator<WindowedBatch<T>> {
    let windowStart: number | null = null;
    let buffer: T[] = [];

    for await (const item of source) {
      if (windowStart === null) {
        windowStart = item.timestamp - (item.timestamp % windowMs);
      }

      const itemWindow = item.timestamp - (item.timestamp % windowMs);

      if (itemWindow > windowStart) {
        if (buffer.length > 0) {
          yield { items: buffer, windowStart, windowEnd: windowStart + windowMs };
        }
        windowStart = itemWindow;
        buffer = [];
      }

      buffer.push(item.value);
    }

    if (buffer.length > 0 && windowStart !== null) {
      yield { items: buffer, windowStart, windowEnd: windowStart + windowMs };
    }
  }

  /**
   * Sliding window — each item may appear in multiple windows.
   *
   * @param source   Async iterable of `{ value: T; timestamp: number }` items
   * @param windowMs Window size in milliseconds
   * @param slideMs  Slide interval in milliseconds (how often a new window starts)
   */
  async *slidingWindow<T>(
    source: AsyncIterable<{ value: T; timestamp: number }>,
    windowMs: number,
    slideMs: number
  ): AsyncGenerator<WindowedBatch<T>> {
    const buffer: Array<{ value: T; timestamp: number }> = [];
    const emittedWindows = new Set<number>();

    for await (const item of source) {
      buffer.push(item);

      // Remove items outside the largest possible window
      const oldest = item.timestamp - windowMs;
      while (buffer.length > 0 && buffer[0].timestamp < oldest) {
        buffer.shift();
      }

      // Determine which sliding window this item triggers
      const windowKey = Math.floor(item.timestamp / slideMs) * slideMs;
      if (!emittedWindows.has(windowKey)) {
        emittedWindows.add(windowKey);
        const windowStart = windowKey;
        const windowEnd = windowStart + windowMs;
        const items = buffer
          .filter((b) => b.timestamp >= windowStart && b.timestamp < windowEnd)
          .map((b) => b.value);
        if (items.length > 0) {
          yield { items, windowStart, windowEnd };
        }
      }
    }
  }

  /**
   * Session window — groups items by inactivity gaps.
   * A new window starts when no item is received for longer than `idleMs`.
   *
   * @param source  Async iterable of items (with optional `.timestamp`)
   * @param idleMs  Gap duration that triggers a new session (default: 30_000ms)
   * @param getTimestamp Function to extract timestamp from an item (default: Date.now())
   */
  async *sessionWindow<T>(
    source: AsyncIterable<T>,
    idleMs: number,
    getTimestamp: (item: T) => number = () => Date.now()
  ): AsyncGenerator<WindowedBatch<T>> {
    let buffer: T[] = [];
    let lastTimestamp: number | null = null;
    let windowStart: number | null = null;

    for await (const item of source) {
      const ts = getTimestamp(item);

      if (lastTimestamp !== null && ts - lastTimestamp > idleMs && buffer.length > 0) {
        yield { items: buffer, windowStart: windowStart!, windowEnd: lastTimestamp };
        buffer = [];
        windowStart = null;
      }

      if (windowStart === null) windowStart = ts;
      buffer.push(item);
      lastTimestamp = ts;
    }

    if (buffer.length > 0 && windowStart !== null && lastTimestamp !== null) {
      yield { items: buffer, windowStart, windowEnd: lastTimestamp };
    }
  }

  /**
   * Join two async streams by a key function.
   * Items from `left` are buffered; when a matching `right` item arrives, they are emitted together.
   *
   * @param left       Left stream
   * @param right      Right stream
   * @param leftKey    Extract join key from left items
   * @param rightKey   Extract join key from right items
   * @param merge      Combine matched left + right items
   * @param windowMs   How long to buffer unmatched left items (default: 60_000ms)
   */
  async *joinStreams<L, R, Out>(
    left: AsyncIterable<L>,
    right: AsyncIterable<R>,
    leftKey: (item: L) => string,
    rightKey: (item: R) => string,
    merge: (l: L, r: R) => Out,
    windowMs = 60_000
  ): AsyncGenerator<Out> {
    const leftBuffer = new Map<string, { item: L; ts: number }>();
    const rightBuffer = new Map<string, { item: R; ts: number }>();
    const now = (): number => Date.now();

    // Flatten both streams into a single tagged stream sequentially
    // For a true concurrent join, use a more complex scheduler —
    // this simpler version drains left first, then right, checking buffers on both sides.
    for await (const lItem of left) {
      const key = leftKey(lItem);
      if (rightBuffer.has(key)) {
        const { item: rItem } = rightBuffer.get(key)!;
        rightBuffer.delete(key);
        yield merge(lItem, rItem);
      } else {
        leftBuffer.set(key, { item: lItem, ts: now() });
      }
      // Expire stale unmatched left items
      const expiry = now() - windowMs;
      for (const [k, v] of leftBuffer) {
        if (v.ts < expiry) leftBuffer.delete(k);
      }
    }

    for await (const rItem of right) {
      const key = rightKey(rItem);
      if (leftBuffer.has(key)) {
        const { item: lItem } = leftBuffer.get(key)!;
        leftBuffer.delete(key);
        yield merge(lItem, rItem);
      } else {
        rightBuffer.set(key, { item: rItem, ts: now() });
      }
      const expiry = now() - windowMs;
      for (const [k, v] of rightBuffer) {
        if (v.ts < expiry) rightBuffer.delete(k);
      }
    }
  }
}
