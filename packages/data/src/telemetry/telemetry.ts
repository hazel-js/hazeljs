/**
 * Telemetry — zero-dependency OpenTelemetry-compatible instrumentation.
 *
 * Works in two modes:
 *  1. **Standalone** — emits structured events to an in-memory log / custom exporters.
 *  2. **OTel** — when @opentelemetry/api is present in the host application,
 *     wraps each pipeline step in an OTel span automatically.
 *
 * The package itself does NOT list @opentelemetry/* as dependencies; it uses
 * dynamic optional `require()` so the feature activates transparently when
 * the host already has it installed.
 */

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface PipelineSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  pipeline: string;
  step: number;
  stepName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'ok' | 'error';
  error?: string;
  skipped?: boolean;
  attributes: Record<string, string | number | boolean>;
}

export interface MetricPoint {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface LineageEntry {
  traceId: string;
  pipeline: string;
  input: unknown;
  steps: Array<{
    step: number;
    name: string;
    inputHash: string;
    outputHash: string;
    durationMs: number;
  }>;
  output: unknown;
  timestamp: Date;
}

export type SpanExporter = (span: PipelineSpan) => void | Promise<void>;
export type MetricExporter = (metric: MetricPoint) => void | Promise<void>;

function generateId(len = 16): string {
  const chars = '0123456789abcdef';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(
    ''
  );
}

function simpleHash(value: unknown): string {
  const str = JSON.stringify(value) ?? '';
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16);
}

/**
 * TelemetryService — collect spans, metrics, and lineage for pipeline executions.
 *
 * @example
 * const telemetry = TelemetryService.getInstance();
 * telemetry.addSpanExporter((span) => console.log(span));
 * telemetry.enableLineage();
 *
 * // Automatically used by ETLService when registered
 * DataModule.forRoot({ telemetry: { enabled: true, serviceName: 'orders-pipeline' } });
 */
export class TelemetryService {
  private static instance: TelemetryService | null = null;

  private serviceName: string;
  private spanExporters: SpanExporter[] = [];
  private metricExporters: MetricExporter[] = [];
  private spans: PipelineSpan[] = [];
  private metrics: MetricPoint[] = [];
  private lineageStore: LineageEntry[] = [];
  private lineageEnabled = false;
  private maxSpansInMemory: number;
  // Loaded lazily if @opentelemetry/api is present in the host app
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private otelApi: Record<string, any> | null = null;

  constructor(options: { serviceName?: string; maxSpansInMemory?: number } = {}) {
    this.serviceName = options.serviceName ?? 'hazeljs-pipeline';
    this.maxSpansInMemory = options.maxSpansInMemory ?? 1000;
    this.tryLoadOtel();
  }

  static getInstance(options?: { serviceName?: string }): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService(options);
    }
    return TelemetryService.instance;
  }

  static reset(): void {
    TelemetryService.instance = null;
  }

  private tryLoadOtel(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.otelApi = require('@opentelemetry/api');
    } catch {
      this.otelApi = null;
    }
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  addSpanExporter(exporter: SpanExporter): this {
    this.spanExporters.push(exporter);
    return this;
  }

  addMetricExporter(exporter: MetricExporter): this {
    this.metricExporters.push(exporter);
    return this;
  }

  enableLineage(): this {
    this.lineageEnabled = true;
    return this;
  }

  // ─── Span Tracking ────────────────────────────────────────────────────────

  startTrace(_pipelineName: string): { traceId: string; rootSpanId: string } {
    const traceId = generateId(32);
    const rootSpanId = generateId(16);
    return { traceId, rootSpanId };
  }

  async recordSpan(
    span: Omit<PipelineSpan, 'traceId' | 'spanId'> & Partial<SpanContext>
  ): Promise<void> {
    const full: PipelineSpan = {
      traceId: span.traceId ?? generateId(32),
      spanId: span.spanId ?? generateId(16),
      ...span,
    };

    if (this.spans.length >= this.maxSpansInMemory) {
      this.spans.shift();
    }
    this.spans.push(full);

    // OTel integration
    if (this.otelApi) {
      try {
        const tracer = this.otelApi['trace'].getTracer(this.serviceName);
        const otelSpan = tracer.startSpan(`pipeline.${full.pipeline}.step.${full.step}`, {
          startTime: full.startTime,
        });
        otelSpan.setAttributes({
          'hazel.pipeline': full.pipeline,
          'hazel.step': full.step,
          'hazel.step.name': full.stepName,
          'hazel.service': this.serviceName,
          ...full.attributes,
        });
        if (full.status === 'error' && full.error) {
          otelSpan.recordException(new Error(full.error));
          otelSpan.setStatus({ code: 2, message: full.error });
        }
        otelSpan.end(full.endTime);
      } catch {
        /* OTel not properly configured */
      }
    }

    for (const exporter of this.spanExporters) {
      try {
        await Promise.resolve(exporter(full));
      } catch {
        /* noop */
      }
    }
  }

  // ─── Metrics ──────────────────────────────────────────────────────────────

  async recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    const point: MetricPoint = {
      name,
      value,
      labels: { service: this.serviceName, ...labels },
      timestamp: Date.now(),
    };
    this.metrics.push(point);
    for (const exporter of this.metricExporters) {
      try {
        await Promise.resolve(exporter(point));
      } catch {
        /* noop */
      }
    }
  }

  async recordStepMetrics(
    pipeline: string,
    stepName: string,
    durationMs: number,
    success: boolean,
    recordCount = 1
  ): Promise<void> {
    const labels = { pipeline, step: stepName };
    await this.recordMetric('hazel.pipeline.step.duration_ms', durationMs, labels);
    await this.recordMetric('hazel.pipeline.step.records', recordCount, labels);
    await this.recordMetric('hazel.pipeline.step.errors', success ? 0 : 1, labels);
    if (durationMs > 0 && recordCount > 0) {
      await this.recordMetric(
        'hazel.pipeline.step.throughput',
        (recordCount / durationMs) * 1000,
        labels
      );
    }
  }

  // ─── Lineage ──────────────────────────────────────────────────────────────

  startLineage(pipeline: string, input: unknown): LineageEntry {
    return {
      traceId: generateId(32),
      pipeline,
      input,
      steps: [],
      output: undefined,
      timestamp: new Date(),
    };
  }

  recordLineageStep(
    entry: LineageEntry,
    step: number,
    name: string,
    input: unknown,
    output: unknown,
    durationMs: number
  ): void {
    if (!this.lineageEnabled) return;
    entry.steps.push({
      step,
      name,
      inputHash: simpleHash(input),
      outputHash: simpleHash(output),
      durationMs,
    });
  }

  finalizeLineage(entry: LineageEntry, output: unknown): void {
    if (!this.lineageEnabled) return;
    entry.output = output;
    this.lineageStore.push(entry);
  }

  // ─── Inspection ───────────────────────────────────────────────────────────

  getSpans(pipeline?: string): PipelineSpan[] {
    return pipeline ? this.spans.filter((s) => s.pipeline === pipeline) : [...this.spans];
  }

  getMetrics(name?: string): MetricPoint[] {
    return name ? this.metrics.filter((m) => m.name === name) : [...this.metrics];
  }

  getLineage(traceId?: string): LineageEntry[] {
    return traceId
      ? this.lineageStore.filter((e) => e.traceId === traceId)
      : [...this.lineageStore];
  }

  /** Compute summary stats for a pipeline across all recorded spans. */
  getSummary(pipeline: string): {
    totalRuns: number;
    successRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
  } {
    const pipelineSpans = this.spans.filter((s) => s.pipeline === pipeline && s.step === 0);
    if (pipelineSpans.length === 0)
      return { totalRuns: 0, successRate: 0, avgDurationMs: 0, p95DurationMs: 0 };

    const durations = pipelineSpans.map((s) => s.durationMs).sort((a, b) => a - b);
    const successes = pipelineSpans.filter((s) => s.status === 'ok').length;
    const p95Idx = Math.floor(durations.length * 0.95);

    return {
      totalRuns: pipelineSpans.length,
      successRate: parseFloat(((successes / pipelineSpans.length) * 100).toFixed(2)),
      avgDurationMs: parseFloat(
        (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)
      ),
      p95DurationMs: durations[p95Idx] ?? durations[durations.length - 1],
    };
  }

  clear(): void {
    this.spans = [];
    this.metrics = [];
    this.lineageStore = [];
  }
}

/**
 * Prometheus-format metric exporter factory.
 * Returns a metric exporter that formats points as Prometheus text.
 *
 * @example
 * const { exporter, getText } = createPrometheusExporter();
 * telemetry.addMetricExporter(exporter);
 * // GET /metrics → getText()
 */
export function createPrometheusExporter(): {
  exporter: MetricExporter;
  getText: () => string;
} {
  const store = new Map<string, MetricPoint[]>();

  const exporter: MetricExporter = (metric) => {
    const existing = store.get(metric.name) ?? [];
    existing.push(metric);
    if (existing.length > 1000) existing.shift();
    store.set(metric.name, existing);
  };

  const getText = (): string => {
    const lines: string[] = [];
    for (const [name, points] of store) {
      const promName = name.replace(/\./g, '_').replace(/-/g, '_');
      lines.push(`# TYPE ${promName} gauge`);
      for (const p of points.slice(-1)) {
        const labels = Object.entries(p.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`${promName}{${labels}} ${p.value} ${p.timestamp}`);
      }
    }
    return lines.join('\n');
  };

  return { exporter, getText };
}
