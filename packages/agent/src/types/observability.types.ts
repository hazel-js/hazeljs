/**
 * Optional observability provider interface (mirrors @hazeljs/observability).
 */

export interface OtelTracerLike {
  startActiveSpan<T>(name: string, fn: (span: unknown) => T): T;
}

export interface ObservabilityProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  getTracer(name: string): OtelTracerLike;
  trackCost(model: string, promptTokens: number, completionTokens: number): void;
}
