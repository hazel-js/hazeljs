"use strict";
/**
 * Tool Executor
 * Executes tools with approval workflow and error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutor = void 0;
const crypto_1 = require("crypto");
const tool_types_1 = require("../types/tool.types");
const event_types_1 = require("../types/event.types");
/**
 * Tool Executor
 * Handles tool execution with approval and retry logic
 */
class ToolExecutor {
    constructor(eventEmitter, guardrailsService) {
        this.eventEmitter = eventEmitter;
        this.guardrailsService = guardrailsService;
        this.pendingApprovals = new Map();
        this.approvalResolvers = new Map();
        this.executionContexts = new Map();
    }
    /**
     * Execute a tool
     */
    async execute(tool, input, agentId, sessionId, userId) {
        const executionId = (0, crypto_1.randomUUID)();
        const startTime = Date.now();
        const context = {
            executionId,
            toolName: tool.name,
            agentId,
            sessionId,
            userId,
            input,
            status: tool_types_1.ToolExecutionStatus.PENDING,
            startedAt: new Date(),
        };
        this.executionContexts.set(executionId, context);
        this.emitEvent(event_types_1.AgentEventType.TOOL_EXECUTION_STARTED, {
            toolName: tool.name,
            input,
        });
        try {
            // Validate input against Zod schema if provided
            if (tool.schema) {
                const parsed = await tool.schema.safeParseAsync(input);
                if (!parsed.success) {
                    context.status = tool_types_1.ToolExecutionStatus.FAILED;
                    context.completedAt = new Date();
                    context.duration = Date.now() - startTime;
                    const errorMsg = `Input validation failed: ${parsed.error.message}`;
                    this.emitEvent(event_types_1.AgentEventType.TOOL_EXECUTION_FAILED, {
                        toolName: tool.name,
                        input,
                        error: errorMsg,
                        duration: context.duration,
                    });
                    return {
                        success: false,
                        error: new Error(errorMsg),
                        duration: context.duration,
                    };
                }
                // Use parsed data which may include defaults/transforms
                input = parsed.data;
                context.input = input;
            }
            if (this.guardrailsService) {
                const inputResult = this.guardrailsService.checkInput(input);
                if (!inputResult.allowed) {
                    context.status = tool_types_1.ToolExecutionStatus.FAILED;
                    context.completedAt = new Date();
                    context.duration = Date.now() - startTime;
                    this.emitEvent(event_types_1.AgentEventType.TOOL_EXECUTION_FAILED, {
                        toolName: tool.name,
                        input,
                        error: inputResult.blockedReason ?? 'Input blocked by guardrails',
                        duration: context.duration,
                    });
                    return {
                        success: false,
                        error: new Error(inputResult.blockedReason ?? 'Input blocked by guardrails'),
                        duration: context.duration,
                    };
                }
                if (inputResult.modified !== undefined) {
                    Object.assign(input, inputResult.modified);
                }
            }
            if (tool.requiresApproval) {
                const { promise, requestId } = this.requestApproval(tool, input, agentId, executionId);
                const approved = await promise;
                if (!approved) {
                    context.status = tool_types_1.ToolExecutionStatus.REJECTED;
                    this.emitEvent(event_types_1.AgentEventType.TOOL_APPROVAL_DENIED, {
                        requestId,
                        toolName: tool.name,
                        input,
                    });
                    return {
                        success: false,
                        error: new Error('Tool execution rejected by user'),
                        duration: Date.now() - startTime,
                    };
                }
                context.status = tool_types_1.ToolExecutionStatus.APPROVED;
                this.emitEvent(event_types_1.AgentEventType.TOOL_APPROVAL_GRANTED, {
                    requestId,
                    toolName: tool.name,
                    input,
                });
            }
            context.status = tool_types_1.ToolExecutionStatus.EXECUTING;
            const result = await this.executeWithRetry(tool, input, tool.retries || 0);
            context.status = tool_types_1.ToolExecutionStatus.COMPLETED;
            context.completedAt = new Date();
            context.duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.TOOL_EXECUTION_COMPLETED, {
                toolName: tool.name,
                input,
                output: result,
                duration: context.duration,
            });
            return {
                success: true,
                output: result,
                duration: context.duration,
            };
        }
        catch (error) {
            context.status = tool_types_1.ToolExecutionStatus.FAILED;
            context.completedAt = new Date();
            context.duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.TOOL_EXECUTION_FAILED, {
                toolName: tool.name,
                input,
                error: error.message,
                duration: context.duration,
            });
            return {
                success: false,
                error: error,
                duration: context.duration,
            };
        }
        finally {
            this.executionContexts.delete(executionId);
        }
    }
    /**
     * Execute tool with retry logic
     */
    async executeWithRetry(tool, input, maxRetries) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const timeout = tool.timeout || 30000;
                const result = await this.executeWithTimeout(tool, input, timeout);
                return result;
            }
            catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }
        throw lastError;
    }
    /**
     * Execute tool with timeout
     */
    async executeWithTimeout(tool, input, timeout) {
        let timeoutId;
        try {
            const result = await Promise.race([
                tool.method.call(tool.target, input),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout);
                }),
            ]);
            if (this.guardrailsService && result !== undefined && result !== null) {
                const outputResult = this.guardrailsService.checkOutput(result);
                if (!outputResult.allowed) {
                    throw new Error(outputResult.blockedReason ?? 'Output blocked by guardrails');
                }
                return outputResult.modified ?? result;
            }
            return result;
        }
        finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
    /**
     * Request approval for tool execution (event-driven: resolves when approve/reject/expire is called).
     * Returns { promise, requestId } so callers can emit events with the correct requestId.
     */
    requestApproval(tool, input, agentId, executionId) {
        const requestId = (0, crypto_1.randomUUID)();
        const expiresAt = new Date(Date.now() + ToolExecutor.DEFAULT_APPROVAL_TTL_MS);
        const request = {
            requestId,
            executionId,
            toolName: tool.name,
            agentId,
            input,
            requestedAt: new Date(),
            expiresAt,
            status: 'pending',
        };
        this.pendingApprovals.set(requestId, request);
        this.emitEvent(event_types_1.AgentEventType.TOOL_APPROVAL_REQUESTED, {
            requestId,
            toolName: tool.name,
            input,
        });
        const promise = new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                const req = this.pendingApprovals.get(requestId);
                if (req && req.status === 'pending') {
                    req.status = 'expired';
                    this.pendingApprovals.delete(requestId);
                    this.approvalResolvers.delete(requestId);
                    resolve(false);
                }
            }, ToolExecutor.DEFAULT_APPROVAL_TTL_MS);
            this.approvalResolvers.set(requestId, { resolve, timeoutId });
        });
        return { promise, requestId };
    }
    /**
     * Approve a tool execution (event-driven: resolves the pending Promise immediately).
     */
    approveExecution(requestId, approvedBy) {
        const request = this.pendingApprovals.get(requestId);
        const resolver = this.approvalResolvers.get(requestId);
        if (request && request.status === 'pending' && resolver) {
            request.status = 'approved';
            request.approvedBy = approvedBy;
            request.approvedAt = new Date();
            if (resolver.timeoutId)
                clearTimeout(resolver.timeoutId);
            this.approvalResolvers.delete(requestId);
            this.pendingApprovals.delete(requestId);
            resolver.resolve(true);
        }
    }
    /**
     * Reject a tool execution (event-driven: resolves the pending Promise immediately).
     */
    rejectExecution(requestId) {
        const request = this.pendingApprovals.get(requestId);
        const resolver = this.approvalResolvers.get(requestId);
        if (request && request.status === 'pending' && resolver) {
            request.status = 'rejected';
            request.rejectedAt = new Date();
            if (resolver.timeoutId)
                clearTimeout(resolver.timeoutId);
            this.approvalResolvers.delete(requestId);
            this.pendingApprovals.delete(requestId);
            resolver.resolve(false);
        }
    }
    /**
     * Get pending approval requests
     */
    getPendingApprovals() {
        return Array.from(this.pendingApprovals.values());
    }
    /**
     * Emit event
     */
    emitEvent(type, data) {
        if (this.eventEmitter) {
            this.eventEmitter(type, data);
        }
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.ToolExecutor = ToolExecutor;
ToolExecutor.DEFAULT_APPROVAL_TTL_MS = 300000;
