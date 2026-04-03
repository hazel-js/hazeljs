"use strict";
/**
 * Metrics Collection
 * Track agent performance and usage metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
class MetricsCollector {
    constructor() {
        this.executionCount = 0;
        this.successCount = 0;
        this.failureCount = 0;
        this.durations = [];
        this.toolCalls = {};
        this.toolSuccesses = 0;
        this.toolFailures = 0;
        this.llmCalls = 0;
        this.llmTokens = 0;
        this.llmErrors = 0;
        this.memoryRetrievals = 0;
        this.memoryRetrievalTimes = [];
        this.startTime = Date.now();
    }
    /**
     * Record an agent execution
     */
    recordExecution(success, durationMs) {
        this.executionCount++;
        if (success) {
            this.successCount++;
        }
        else {
            this.failureCount++;
        }
        this.durations.push(durationMs);
        // Keep only last 1000 durations to prevent memory bloat
        if (this.durations.length > 1000) {
            this.durations = this.durations.slice(-1000);
        }
    }
    /**
     * Record a tool call
     */
    recordToolCall(toolName, success) {
        this.toolCalls[toolName] = (this.toolCalls[toolName] || 0) + 1;
        if (success) {
            this.toolSuccesses++;
        }
        else {
            this.toolFailures++;
        }
    }
    /**
     * Record an LLM call
     */
    recordLLMCall(tokens, error = false) {
        this.llmCalls++;
        this.llmTokens += tokens;
        if (error) {
            this.llmErrors++;
        }
    }
    /**
     * Record a memory retrieval
     */
    recordMemoryRetrieval(durationMs) {
        this.memoryRetrievals++;
        this.memoryRetrievalTimes.push(durationMs);
        // Keep only last 1000 retrieval times
        if (this.memoryRetrievalTimes.length > 1000) {
            this.memoryRetrievalTimes = this.memoryRetrievalTimes.slice(-1000);
        }
    }
    /**
     * Get all metrics
     */
    getMetrics() {
        const sortedDurations = [...this.durations].sort((a, b) => a - b);
        const totalToolCalls = this.toolSuccesses + this.toolFailures;
        return {
            executions: {
                total: this.executionCount,
                successful: this.successCount,
                failed: this.failureCount,
                successRate: this.executionCount > 0 ? this.successCount / this.executionCount : 0,
            },
            performance: {
                averageDuration: this.calculateAverage(this.durations),
                minDuration: Math.min(...this.durations, Infinity),
                maxDuration: Math.max(...this.durations, -Infinity),
                p50Duration: this.calculatePercentile(sortedDurations, 50),
                p95Duration: this.calculatePercentile(sortedDurations, 95),
                p99Duration: this.calculatePercentile(sortedDurations, 99),
            },
            tools: {
                totalCalls: totalToolCalls,
                byTool: { ...this.toolCalls },
                successRate: totalToolCalls > 0 ? this.toolSuccesses / totalToolCalls : 0,
            },
            llm: {
                totalCalls: this.llmCalls,
                totalTokens: this.llmTokens,
                averageTokensPerCall: this.llmCalls > 0 ? this.llmTokens / this.llmCalls : 0,
                errors: this.llmErrors,
            },
            memory: {
                totalRetrievals: this.memoryRetrievals,
                averageRetrievalTime: this.calculateAverage(this.memoryRetrievalTimes),
            },
        };
    }
    /**
     * Get metrics summary as string
     */
    getSummary() {
        const metrics = this.getMetrics();
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        return `
Agent Metrics Summary
=====================
Uptime: ${uptime}s

Executions:
  Total: ${metrics.executions.total}
  Success: ${metrics.executions.successful}
  Failed: ${metrics.executions.failed}
  Success Rate: ${(metrics.executions.successRate * 100).toFixed(2)}%

Performance:
  Avg Duration: ${metrics.performance.averageDuration.toFixed(2)}ms
  P50: ${metrics.performance.p50Duration.toFixed(2)}ms
  P95: ${metrics.performance.p95Duration.toFixed(2)}ms
  P99: ${metrics.performance.p99Duration.toFixed(2)}ms

Tools:
  Total Calls: ${metrics.tools.totalCalls}
  Success Rate: ${(metrics.tools.successRate * 100).toFixed(2)}%
  Top Tools: ${Object.entries(metrics.tools.byTool)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `${name} (${count})`)
            .join(', ')}

LLM:
  Total Calls: ${metrics.llm.totalCalls}
  Total Tokens: ${metrics.llm.totalTokens}
  Avg Tokens/Call: ${metrics.llm.averageTokensPerCall.toFixed(2)}
  Errors: ${metrics.llm.errors}

Memory:
  Total Retrievals: ${metrics.memory.totalRetrievals}
  Avg Retrieval Time: ${metrics.memory.averageRetrievalTime.toFixed(2)}ms
    `.trim();
    }
    /**
     * Reset all metrics
     */
    reset() {
        this.executionCount = 0;
        this.successCount = 0;
        this.failureCount = 0;
        this.durations = [];
        this.toolCalls = {};
        this.toolSuccesses = 0;
        this.toolFailures = 0;
        this.llmCalls = 0;
        this.llmTokens = 0;
        this.llmErrors = 0;
        this.memoryRetrievals = 0;
        this.memoryRetrievalTimes = [];
        this.startTime = Date.now();
    }
    calculateAverage(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    calculatePercentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        return sortedValues[Math.max(0, index)] || 0;
    }
}
exports.MetricsCollector = MetricsCollector;
