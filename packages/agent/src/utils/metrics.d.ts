/**
 * Metrics Collection
 * Track agent performance and usage metrics
 */
export interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  lastUpdated: number;
}
export interface AgentMetrics {
  executions: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  performance: {
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  };
  tools: {
    totalCalls: number;
    byTool: Record<string, number>;
    successRate: number;
  };
  llm: {
    totalCalls: number;
    totalTokens: number;
    averageTokensPerCall: number;
    errors: number;
  };
  memory: {
    totalRetrievals: number;
    averageRetrievalTime: number;
  };
}
export declare class MetricsCollector {
  private executionCount;
  private successCount;
  private failureCount;
  private durations;
  private toolCalls;
  private toolSuccesses;
  private toolFailures;
  private llmCalls;
  private llmTokens;
  private llmErrors;
  private memoryRetrievals;
  private memoryRetrievalTimes;
  private startTime;
  constructor();
  /**
   * Record an agent execution
   */
  recordExecution(success: boolean, durationMs: number): void;
  /**
   * Record a tool call
   */
  recordToolCall(toolName: string, success: boolean): void;
  /**
   * Record an LLM call
   */
  recordLLMCall(tokens: number, error?: boolean): void;
  /**
   * Record a memory retrieval
   */
  recordMemoryRetrieval(durationMs: number): void;
  /**
   * Get all metrics
   */
  getMetrics(): AgentMetrics;
  /**
   * Get metrics summary as string
   */
  getSummary(): string;
  /**
   * Reset all metrics
   */
  reset(): void;
  private calculateAverage;
  private calculatePercentile;
}
//# sourceMappingURL=metrics.d.ts.map
