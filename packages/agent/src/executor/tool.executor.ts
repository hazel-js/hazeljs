/**
 * Tool Executor
 * Executes tools with approval workflow and error handling
 */

import { randomUUID } from 'crypto';
import {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutionStatus,
  ToolApprovalRequest,
  ToolMetadata,
} from '../types/tool.types';
import { AgentEventType } from '../types/event.types';
import type { IGuardrailsService } from '../types/agent.types';

/** Resolver for event-driven approval: resolve(true) = approved, resolve(false) = rejected/expired */
interface PendingApprovalResolver {
  resolve: (approved: boolean) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Tool Executor
 * Handles tool execution with approval and retry logic
 */
export class ToolExecutor {
  private pendingApprovals: Map<string, ToolApprovalRequest> = new Map();
  private approvalResolvers: Map<string, PendingApprovalResolver> = new Map();
  private executionContexts: Map<string, ToolExecutionContext> = new Map();

  private static readonly DEFAULT_APPROVAL_TTL_MS = 300_000;

  constructor(
    private eventEmitter?: (type: AgentEventType, data: unknown) => void,
    private guardrailsService?: IGuardrailsService
  ) {}

  /**
   * Execute a tool
   */
  async execute(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    userId?: string
  ): Promise<ToolExecutionResult> {
    const executionId = randomUUID();
    const startTime = Date.now();

    const context: ToolExecutionContext = {
      executionId,
      toolName: tool.name,
      agentId,
      sessionId,
      userId,
      input,
      status: ToolExecutionStatus.PENDING,
      startedAt: new Date(),
    };

    this.executionContexts.set(executionId, context);

    this.emitEvent(AgentEventType.TOOL_EXECUTION_STARTED, {
      toolName: tool.name,
      input,
    });

    try {
      if (this.guardrailsService) {
        const inputResult = this.guardrailsService.checkInput(input);
        if (!inputResult.allowed) {
          context.status = ToolExecutionStatus.FAILED;
          context.completedAt = new Date();
          context.duration = Date.now() - startTime;

          this.emitEvent(AgentEventType.TOOL_EXECUTION_FAILED, {
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
          Object.assign(input, inputResult.modified as Record<string, unknown>);
        }
      }

      if (tool.requiresApproval) {
        const { promise, requestId } = this.requestApproval(tool, input, agentId, executionId);
        const approved = await promise;

        if (!approved) {
          context.status = ToolExecutionStatus.REJECTED;

          this.emitEvent(AgentEventType.TOOL_APPROVAL_DENIED, {
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

        context.status = ToolExecutionStatus.APPROVED;
        this.emitEvent(AgentEventType.TOOL_APPROVAL_GRANTED, {
          requestId,
          toolName: tool.name,
          input,
        });
      }

      context.status = ToolExecutionStatus.EXECUTING;

      const result = await this.executeWithRetry(tool, input, tool.retries || 0);

      context.status = ToolExecutionStatus.COMPLETED;
      context.completedAt = new Date();
      context.duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.TOOL_EXECUTION_COMPLETED, {
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
    } catch (error) {
      context.status = ToolExecutionStatus.FAILED;
      context.completedAt = new Date();
      context.duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.TOOL_EXECUTION_FAILED, {
        toolName: tool.name,
        input,
        error: (error as Error).message,
        duration: context.duration,
      });

      return {
        success: false,
        error: error as Error,
        duration: context.duration,
      };
    } finally {
      this.executionContexts.delete(executionId);
    }
  }

  /**
   * Execute tool with retry logic
   */
  private async executeWithRetry(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    maxRetries: number
  ): Promise<unknown> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeout = tool.timeout || 30000;
        const result = await this.executeWithTimeout(tool, input, timeout);
        return result;
      } catch (error) {
        lastError = error as Error;

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
  private async executeWithTimeout(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    timeout: number
  ): Promise<unknown> {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race([
        tool.method.call(tool.target, input),
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`Tool execution timeout after ${timeout}ms`)),
            timeout
          );
        }),
      ]);

      if (this.guardrailsService && result !== undefined && result !== null) {
        const outputResult = this.guardrailsService.checkOutput(result as string | object);
        if (!outputResult.allowed) {
          throw new Error(outputResult.blockedReason ?? 'Output blocked by guardrails');
        }
        return outputResult.modified ?? result;
      }

      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Request approval for tool execution (event-driven: resolves when approve/reject/expire is called).
   * Returns { promise, requestId } so callers can emit events with the correct requestId.
   */
  private requestApproval(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    agentId: string,
    executionId: string
  ): { promise: Promise<boolean>; requestId: string } {
    const requestId = randomUUID();
    const expiresAt = new Date(Date.now() + ToolExecutor.DEFAULT_APPROVAL_TTL_MS);

    const request: ToolApprovalRequest = {
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

    this.emitEvent(AgentEventType.TOOL_APPROVAL_REQUESTED, {
      requestId,
      toolName: tool.name,
      input,
    });

    const promise = new Promise<boolean>((resolve) => {
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
  approveExecution(requestId: string, approvedBy: string): void {
    const request = this.pendingApprovals.get(requestId);
    const resolver = this.approvalResolvers.get(requestId);
    if (request && request.status === 'pending' && resolver) {
      request.status = 'approved';
      request.approvedBy = approvedBy;
      request.approvedAt = new Date();
      if (resolver.timeoutId) clearTimeout(resolver.timeoutId);
      this.approvalResolvers.delete(requestId);
      this.pendingApprovals.delete(requestId);
      resolver.resolve(true);
    }
  }

  /**
   * Reject a tool execution (event-driven: resolves the pending Promise immediately).
   */
  rejectExecution(requestId: string): void {
    const request = this.pendingApprovals.get(requestId);
    const resolver = this.approvalResolvers.get(requestId);
    if (request && request.status === 'pending' && resolver) {
      request.status = 'rejected';
      request.rejectedAt = new Date();
      if (resolver.timeoutId) clearTimeout(resolver.timeoutId);
      this.approvalResolvers.delete(requestId);
      this.pendingApprovals.delete(requestId);
      resolver.resolve(false);
    }
  }

  /**
   * Get pending approval requests
   */
  getPendingApprovals(): ToolApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Emit event
   */
  private emitEvent(type: AgentEventType, data: unknown): void {
    if (this.eventEmitter) {
      this.eventEmitter(type, data);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
