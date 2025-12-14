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

/**
 * Tool Executor
 * Handles tool execution with approval and retry logic
 */
export class ToolExecutor {
  private pendingApprovals: Map<string, ToolApprovalRequest> = new Map();
  private executionContexts: Map<string, ToolExecutionContext> = new Map();

  constructor(private eventEmitter?: (type: AgentEventType, data: unknown) => void) {}

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
      if (tool.requiresApproval) {
        const approved = await this.requestApproval(tool, input, agentId, executionId);

        if (!approved) {
          context.status = ToolExecutionStatus.REJECTED;

          this.emitEvent(AgentEventType.TOOL_APPROVAL_DENIED, {
            requestId: executionId,
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
          requestId: executionId,
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
    return Promise.race([
      tool.method.call(tool.target, input),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Request approval for tool execution
   */
  private async requestApproval(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    agentId: string,
    executionId: string
  ): Promise<boolean> {
    const requestId = randomUUID();

    const request: ToolApprovalRequest = {
      requestId,
      executionId,
      toolName: tool.name,
      agentId,
      input,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
    };

    this.pendingApprovals.set(requestId, request);

    this.emitEvent(AgentEventType.TOOL_APPROVAL_REQUESTED, {
      requestId,
      toolName: tool.name,
      input,
    });

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const req = this.pendingApprovals.get(requestId);

        if (!req) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        if (req.expiresAt && req.expiresAt < new Date()) {
          this.pendingApprovals.delete(requestId);
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 1000);
    });
  }

  /**
   * Approve a tool execution
   */
  approveExecution(requestId: string, _approvedBy: string): void {
    const request = this.pendingApprovals.get(requestId);
    if (request) {
      this.pendingApprovals.delete(requestId);
    }
  }

  /**
   * Reject a tool execution
   */
  rejectExecution(requestId: string): void {
    this.pendingApprovals.delete(requestId);
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
