/**
 * Resolve audit sinks for common app setups (console, optional OTEL, test memory).
 */

import {
  CompositeAuditSink,
  ConsoleAuditSink,
  createOtelAuditSink,
  InMemoryAuditSink,
  type AuditSink,
} from '../audit/sink';

export interface ResolveAuditSinkOptions {
  /** Force in-memory sink (default: true when JEST_WORKER_ID is set). */
  testMode?: boolean;
  /** Prefer console audit (default true when not in testMode). */
  console?: boolean;
  /** Attempt to attach OTEL when `@opentelemetry/api` is available (default true). */
  otel?: boolean;
  /** Extra sinks to compose. */
  extra?: AuditSink[];
}

export function resolveAuditSink(
  options: ResolveAuditSinkOptions = {}
): { sink: AuditSink; backend: string } {
  const testMode =
    options.testMode ?? process.env.JEST_WORKER_ID !== undefined;

  if (testMode) {
    return { sink: new InMemoryAuditSink(), backend: 'memory' };
  }

  const parts: AuditSink[] = [];
  const labels: string[] = [];

  if (options.console !== false) {
    parts.push(new ConsoleAuditSink());
    labels.push('console');
  }

  if (options.otel !== false) {
    try {
      // Optional peer — present when the process is already instrumented.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const otel = require('@opentelemetry/api') as { trace?: { getTracer: unknown } };
      if (otel?.trace) {
        parts.push(createOtelAuditSink({ trace: otel.trace as never }));
        labels.push('otel');
      }
    } catch {
      /* peer not installed */
    }
  }

  if (options.extra?.length) {
    parts.push(...options.extra);
    labels.push('extra');
  }

  if (parts.length === 0) {
    return { sink: new InMemoryAuditSink(), backend: 'memory' };
  }

  return {
    sink: parts.length === 1 ? parts[0] : new CompositeAuditSink(parts),
    backend: labels.join('+'),
  };
}
