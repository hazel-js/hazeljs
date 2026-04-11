import type { HCELEvent } from './hcel.types';

let hcelGlobalTraceEnabled = false;
const MAX = 300;
const buffer: HCELEvent[] = [];

/**
 * When enabled, all {@link HCELEngine} events are copied to an in-memory ring buffer
 * for the Inspector UI (`/__hazel/hcel/trace`).
 */
export function setHCELGlobalTraceEnabled(enabled: boolean): void {
  hcelGlobalTraceEnabled = enabled;
  if (!enabled) {
    buffer.length = 0;
  }
}

export function isHCELGlobalTraceEnabled(): boolean {
  return hcelGlobalTraceEnabled;
}

export function pushHCELTraceEvent(event: HCELEvent): void {
  if (!hcelGlobalTraceEnabled) return;
  buffer.push(event);
  while (buffer.length > MAX) {
    buffer.shift();
  }
}

export function getHCELTraceSnapshot(): HCELEvent[] {
  return [...buffer];
}

export function clearHCELTraceBuffer(): void {
  buffer.length = 0;
}
