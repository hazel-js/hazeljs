/**
 * Analytics emitter - forwards metrics to event bus
 */

import type { EventBus } from '../bus/eventBus';
import type { HazelEvent } from '@hazeljs/contracts';

/** Emit metric to bus (used by ctx.metrics) */
export function emitMetric(
  bus: EventBus,
  name: string,
  value: number,
  tags?: Record<string, string | number | boolean>,
): void {
  bus.publish({ type: 'metric', name, value, tags });
}

/** Emit span to bus */
export function emitSpan(
  bus: EventBus,
  name: string,
  durationMs: number,
  status: 'ok' | 'error',
  tags?: Record<string, string | number | boolean>,
): void {
  bus.publish({ type: 'span', name, durationMs, status, tags });
}
