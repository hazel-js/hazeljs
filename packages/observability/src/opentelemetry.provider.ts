/* eslint-disable no-console */
import { trace, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ObservabilityProvider, ObservabilityConfig } from './types';

/**
 * OpenTelemetry implementation of the ObservabilityProvider
 */
export class OpenTelemetryProvider implements ObservabilityProvider {
  private config: ObservabilityConfig;
  private provider: NodeTracerProvider;
  private exporter?: OTLPTraceExporter;

  constructor(config: ObservabilityConfig) {
    this.config = config;

    // Set up standard node tracer provider
    this.provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      }),
    });
  }

  /**
   * Start tracking observability metrics
   */
  async start(): Promise<void> {
    if (this.config.otlpEndpoint) {
      this.exporter = new OTLPTraceExporter({
        url: this.config.otlpEndpoint,
      });
      // Use BatchSpanProcessor for production exports
      this.provider.addSpanProcessor(new BatchSpanProcessor(this.exporter));
    }

    // Register provider globally so trace decorators can pick it up
    this.provider.register();

    console.log(`[Observability] Started tracing service ${this.config.serviceName}`);
  }

  /**
   * Stop operations gracefully, ensuring spans flush
   */
  async stop(): Promise<void> {
    try {
      await this.provider.shutdown();
      if (this.exporter) {
        await this.exporter.shutdown();
      }
      console.log(`[Observability] Stopped tracing service ${this.config.serviceName}`);
    } catch (e) {
      console.error('[Observability] Failed to shutdown opentelemetry gracefully', e);
    }
  }

  /**
   * Retrieves a named tracer
   */
  getTracer(name: string): Tracer {
    return trace.getTracer(name);
  }

  /**
   * Tracking LLM cost allows the agent runtime to dynamically emit span metrics or print usage statistics
   */
  trackCost(model: string, promptTokens: number, completionTokens: number): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute('llm.model', model);
      activeSpan.setAttribute('llm.usage.prompt_tokens', promptTokens);
      activeSpan.setAttribute('llm.usage.completion_tokens', completionTokens);
      activeSpan.setAttribute('llm.usage.total_tokens', promptTokens + completionTokens);
    }
  }
}
