/**
 * Health Check System
 * Monitor agent runtime health and dependencies
 */
import { LLMProvider } from '../types/llm.types';
import { RAGService } from '../types/rag.types';
export declare enum HealthStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    UNHEALTHY = "unhealthy"
}
export interface ComponentHealth {
    status: HealthStatus;
    message?: string;
    latencyMs?: number;
    lastCheck?: number;
}
export interface HealthCheckResult {
    status: HealthStatus;
    timestamp: number;
    uptime: number;
    components: {
        llmProvider?: ComponentHealth;
        ragService?: ComponentHealth;
        memory?: ComponentHealth;
    };
    metrics?: {
        totalExecutions: number;
        successRate: number;
        averageLatency: number;
    };
}
export interface HealthCheckConfig {
    checkIntervalMs?: number;
    timeoutMs?: number;
}
export declare class HealthChecker {
    private startTime;
    private lastCheck?;
    private config;
    constructor(config?: HealthCheckConfig);
    /**
     * Perform a health check
     */
    check(llmProvider?: LLMProvider, ragService?: RAGService, metrics?: {
        totalExecutions: number;
        successRate: number;
        averageLatency: number;
    }): Promise<HealthCheckResult>;
    /**
     * Check a single component
     */
    private checkComponent;
    /**
     * Determine overall status from component statuses
     */
    private determineOverallStatus;
    /**
     * Get last health check result
     */
    getLastCheck(): HealthCheckResult | undefined;
    /**
     * Get uptime in seconds
     */
    getUptime(): number;
    /**
     * Format health check result as string
     */
    formatResult(result: HealthCheckResult): string;
}
//# sourceMappingURL=health-check.d.ts.map