/**
 * Optional OpenTelemetry span helpers for agent runtime (no hard dependency on @hazeljs/observability).
 */

import type { ObservabilityProvider } from '../types/observability.types';

type SpanLike = {
  setAttribute: (key: string, value: string | number | boolean) => void;
  recordException: (error: Error) => void;
  setStatus: (status: { code: number; message?: string }) => void;
  end: () => void;
};

const SPAN_OK = 1;
const SPAN_ERROR = 2;

let otelApi: typeof import('@opentelemetry/api') | null | undefined;
let otelLoadFailed = false;

function getOtelApiSync(): typeof import('@opentelemetry/api') | null {
  if (otelApi !== undefined) {
    return otelApi;
  }
  if (otelLoadFailed) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    otelApi = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
    return otelApi;
  } catch {
    otelLoadFailed = true;
    otelApi = null;
    return null;
  }
}

async function loadOtelApi(): Promise<typeof import('@opentelemetry/api') | null> {
  const sync = getOtelApiSync();
  if (sync) return sync;
  if (otelLoadFailed) return null;
  try {
    otelApi = await import('@opentelemetry/api');
    return otelApi;
  } catch {
    otelLoadFailed = true;
    otelApi = null;
    return null;
  }
}

export async function withAgentSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
  observability?: ObservabilityProvider
): Promise<T> {
  if (!observability) {
    return fn();
  }

  const api = getOtelApiSync() ?? (await loadOtelApi());
  if (!api) {
    return fn();
  }

  const tracer = observability?.getTracer('hazeljs-agent') ?? api.trace.getTracer('hazeljs-agent');

  return tracer.startActiveSpan(name, async (span: unknown) => {
    const activeSpan = span as SpanLike;
    for (const [key, value] of Object.entries(attributes)) {
      activeSpan.setAttribute(key, value);
    }
    try {
      const result = await fn();
      activeSpan.setStatus({ code: SPAN_OK });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      activeSpan.recordException(err);
      activeSpan.setStatus({ code: SPAN_ERROR, message: err.message });
      throw error;
    } finally {
      activeSpan.end();
    }
  });
}

export function trackLlmCost(
  observability: ObservabilityProvider | undefined,
  model: string | undefined,
  usage?: { promptTokens?: number; completionTokens?: number }
): void {
  if (!observability || !model || !usage) return;
  observability.trackCost(model, usage.promptTokens ?? 0, usage.completionTokens ?? 0);
}
