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
import { IApprovalStore } from '../approval/approval-store.interface';
import { InMemoryApprovalStore } from '../approval/in-memory-approval.store';
import { RedisApprovalStore } from '../approval/redis-approval.store';
import { withAgentSpan } from '../utils/agent-tracing';
import type { ObservabilityProvider } from '../types/observability.types';

export interface ToolExecutorOptions {
  eventEmitter?: (type: AgentEventType, data: unknown) => void;
  guardrailsService?: IGuardrailsService;
  approvalStore?: IApprovalStore;
  observabilityProvider?: ObservabilityProvider;
  policyEngine?: import('../policies/policy.engine').PolicyEngine;
}

/**
 * Tool Executor
 * Handles tool execution with approval and retry logic
 */
export class ToolExecutor {
  private readonly approvalStore: IApprovalStore;
  private readonly executionContexts = new Map<string, ToolExecutionContext>();

  private static readonly DEFAULT_APPROVAL_TTL_MS = 300_000;

  constructor(private options: ToolExecutorOptions = {}) {
    this.approvalStore = options.approvalStore ?? new InMemoryApprovalStore();
  }

  setPolicyEngine(engine: import('../policies/policy.engine').PolicyEngine): void {
    this.options.policyEngine = engine;
  }

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
    return withAgentSpan(
      'agent.tool.execute',
      { 'agent.tool.name': tool.name, 'agent.id': agentId, 'agent.session_id': sessionId },
      () => this.executeInternal(tool, input, agentId, sessionId, userId),
      this.options.observabilityProvider
    );
  }

  private async executeInternal(
    toolMeta: ToolMetadata,
    input: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    userId?: string
  ): Promise<ToolExecutionResult> {
    let tool = toolMeta;
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
      if (this.options.policyEngine) {
        const decision = this.options.policyEngine.evaluate(tool.name, input);
        input = decision.input;
        context.input = input;
        if (!decision.allowed) {
          context.status = ToolExecutionStatus.FAILED;
          context.completedAt = new Date();
          context.duration = Date.now() - startTime;
          const errorMsg = decision.reason ?? 'Denied by policy';
          this.emitEvent(AgentEventType.TOOL_EXECUTION_FAILED, {
            toolName: tool.name,
            input,
            error: errorMsg,
            duration: context.duration,
            policyRuleId: decision.ruleId,
          });
          return {
            success: false,
            error: new Error(errorMsg),
            duration: context.duration,
          };
        }
        if (decision.requiresApproval) {
          tool = { ...tool, requiresApproval: true };
        }
      }

      if (tool.schema) {
        const parsed = await tool.schema.safeParseAsync(input);
        if (!parsed.success) {
          context.status = ToolExecutionStatus.FAILED;
          context.completedAt = new Date();
          context.duration = Date.now() - startTime;
          const errorMsg = `Input validation failed: ${parsed.error.message}`;

          this.emitEvent(AgentEventType.TOOL_EXECUTION_FAILED, {
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
        input = parsed.data as Record<string, unknown>;
        context.input = input;
      }

      if (this.options.guardrailsService) {
        const inputResult = this.options.guardrailsService.checkInput(input);
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
        const { promise, requestId } = await this.requestApproval(
          tool,
          input,
          agentId,
          executionId
        );
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

  private async executeWithRetry(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    maxRetries: number
  ): Promise<unknown> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeout = tool.timeout || 30000;
        return await this.executeWithTimeout(tool, input, timeout);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError;
  }

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

      if (this.options.guardrailsService && result !== undefined && result !== null) {
        const outputResult = this.options.guardrailsService.checkOutput(result as string | object);
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

  private async requestApproval(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    agentId: string,
    executionId: string
  ): Promise<{ promise: Promise<boolean>; requestId: string }> {
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

    const createResult = this.approvalStore.create(request);

    const promise = new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(async () => {
        const req = await this.unwrap(this.approvalStore.get(requestId));
        if (req && req.status === 'pending') {
          req.status = 'expired';
          await this.unwrap(this.approvalStore.delete(requestId));
          resolve(false);
        }
      }, ToolExecutor.DEFAULT_APPROVAL_TTL_MS);

      if (this.approvalStore instanceof InMemoryApprovalStore) {
        this.approvalStore.registerResolver(requestId, { resolve, timeoutId });
        return;
      }

      if (this.approvalStore instanceof RedisApprovalStore) {
        this.approvalStore.registerResolver(requestId, { resolve, timeoutId });
        void this.approvalStore
          .waitForResolution(requestId, expiresAt)
          .then((approved) => {
            clearTimeout(timeoutId);
            resolve(approved);
          })
          .catch(() => {
            clearTimeout(timeoutId);
            resolve(false);
          });
      }
    });

    if (createResult instanceof Promise) {
      await createResult;
    }

    this.emitEvent(AgentEventType.TOOL_APPROVAL_REQUESTED, {
      requestId,
      toolName: tool.name,
      input,
    });

    return { promise, requestId };
  }

  approveExecution(requestId: string, approvedBy: string): void {
    void this.approvalStore.approve(requestId, approvedBy);
  }

  rejectExecution(requestId: string): void {
    void this.approvalStore.reject(requestId);
  }

  getPendingApprovals(): ToolApprovalRequest[] {
    const result = this.approvalStore.listPending();
    return result instanceof Promise ? [] : result;
  }

  async getPendingApprovalsAsync(): Promise<ToolApprovalRequest[]> {
    return this.unwrap(this.approvalStore.listPending());
  }

  private emitEvent(type: AgentEventType, data: unknown): void {
    this.options.eventEmitter?.(type, data);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async unwrap<T>(value: T | Promise<T>): Promise<T> {
    return value instanceof Promise ? await value : value;
  }
}
