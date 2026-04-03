/**
 * Tool Executor
 * Executes tools with approval workflow and error handling
 */
import { ToolExecutionResult, ToolApprovalRequest, ToolMetadata } from '../types/tool.types';
import { AgentEventType } from '../types/event.types';
import type { IGuardrailsService } from '../types/agent.types';
/**
 * Tool Executor
 * Handles tool execution with approval and retry logic
 */
export declare class ToolExecutor {
    private eventEmitter?;
    private guardrailsService?;
    private pendingApprovals;
    private approvalResolvers;
    private executionContexts;
    private static readonly DEFAULT_APPROVAL_TTL_MS;
    constructor(eventEmitter?: ((type: AgentEventType, data: unknown) => void) | undefined, guardrailsService?: IGuardrailsService | undefined);
    /**
     * Execute a tool
     */
    execute(tool: ToolMetadata, input: Record<string, unknown>, agentId: string, sessionId: string, userId?: string): Promise<ToolExecutionResult>;
    /**
     * Execute tool with retry logic
     */
    private executeWithRetry;
    /**
     * Execute tool with timeout
     */
    private executeWithTimeout;
    /**
     * Request approval for tool execution (event-driven: resolves when approve/reject/expire is called).
     * Returns { promise, requestId } so callers can emit events with the correct requestId.
     */
    private requestApproval;
    /**
     * Approve a tool execution (event-driven: resolves the pending Promise immediately).
     */
    approveExecution(requestId: string, approvedBy: string): void;
    /**
     * Reject a tool execution (event-driven: resolves the pending Promise immediately).
     */
    rejectExecution(requestId: string): void;
    /**
     * Get pending approval requests
     */
    getPendingApprovals(): ToolApprovalRequest[];
    /**
     * Emit event
     */
    private emitEvent;
    /**
     * Delay helper
     */
    private delay;
}
//# sourceMappingURL=tool.executor.d.ts.map