import { Tracer } from '@opentelemetry/api';

/**
 * Interface for tracking and reporting observability metrics
 */
export interface ObservabilityProvider {
  /**
   * Initializes the tracing provider setup (e.g., OpenTelemetry NodeSDK)
   */
  start(): Promise<void>;

  /**
   * Stops and flushes the tracing provider setup
   */
  stop(): Promise<void>;

  /**
   * Retrieves the tracer
   */
  getTracer(name: string): Tracer;

  /**
   * Tracks LLM cost metrics
   * @param model Model name (e.g., 'gpt-4o')
   * @param promptTokens Number of tokens in the prompt
   * @param completionTokens Number of tokens in the completion
   */
  trackCost(model: string, promptTokens: number, completionTokens: number): void;
}

/**
 * Represents the configuration properties to setup tracing
 */
export interface ObservabilityConfig {
  /** The service name to appear in tracing tools (e.g. 'agent-runtime') */
  serviceName: string;
  /** Otlp GRPC/HTTP exporter endpoint (e.g., Datadog, Jaeger, Zipkin) */
  otlpEndpoint?: string;
  /** Whether to log prompts directly to the spans (false by default for privacy) */
  logPrompts?: boolean;
}
