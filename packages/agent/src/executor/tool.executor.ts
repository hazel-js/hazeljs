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
import { getApprovalMetadata } from '../decorators/approval.decorator';
import type { ToolAuthorizationGate } from '../authorization/tool-authorization-gate.interface';
import type { IToolEffectGate } from '../effects/tool-effect-gate.interface';
export interface ToolExecutorOptions {
  eventEmitter?: (type: AgentEventType, data: unknown) => void;
  guardrailsService?: IGuardrailsService;
  approvalStore?: IApprovalStore;
  observabilityProvider?: ObservabilityProvider;
  policyEngine?: import('../policies/policy.engine').PolicyEngine;
  /** Fired when a tool waits for human approval (AgentRun id when known). */
  onApprovalRequested?: (info: {
    runId?: string;
    requestId: string;
    toolName: string;
    input: Record<string, unknown>;
  }) => void | Promise<void>;
  /** Fired after approval is granted or denied. */
  onApprovalResolved?: (info: {
    runId?: string;
    requestId: string;
    approved: boolean;
  }) => void | Promise<void>;
  /**
   * When true, approval-required tools return `pendingApproval` instead of awaiting
   * an in-process promise (AOS-006 durable HITL).
   */
  durableSuspend?: boolean;
  /** Capability + policy gate (AOS-008). */
  policyService?: import('../policies/policy.service').PolicyService;
  /** Agent identity for capability checks (AOS-008). */
  agentIdentity?: import('../identity/agent-identity').AgentIdentity;
  /**
   * Optional external authorization gate (e.g. @hazeljs/agent-gatekeeper).
   * When set, policy engine evaluation is skipped for that invocation.
   */
  authorizationGate?: ToolAuthorizationGate;
  /** Effect gate for @hazeljs/agent-vm — journaling and speculation barriers. */
  effectGate?: IToolEffectGate;
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

  setDurableSuspend(enabled: boolean): void {
    this.options.durableSuspend = enabled;
  }

  setPolicyService(service: import('../policies/policy.service').PolicyService): void {
    this.options.policyService = service;
  }

  setAgentIdentity(identity: import('../identity/agent-identity').AgentIdentity | undefined): void {
    this.options.agentIdentity = identity;
    this.options.policyService?.setIdentity(identity);
  }

  setAuthorizationGate(gate: ToolAuthorizationGate | undefined): void {
    this.options.authorizationGate = gate;
  }

  setEffectGate(gate: IToolEffectGate | undefined): void {
    this.options.effectGate = gate;
  }

  /**
   * Execute a tool
   */
  async execute(
    tool: ToolMetadata,
    input: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    userId?: string,
    runId?: string,
    opts?: { skipApproval?: boolean }
  ): Promise<ToolExecutionResult> {
    return withAgentSpan(
      'agent.tool.execute',
      {
        'agent.tool.name': tool.name,
        'agent.id': agentId,
        'agent.name': agentId,
        'agent.session_id': sessionId,
        'agent.run_id': runId ?? '',
        'agent.execution_id': runId ?? '',
      },
      () => this.executeInternal(tool, input, agentId, sessionId, userId, runId, opts),
      this.options.observabilityProvider
    );
  }

  private async executeInternal(
    toolMeta: ToolMetadata,
    input: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    userId?: string,
    runId?: string,
    opts?: { skipApproval?: boolean }
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
      if (this.options.authorizationGate) {
        const gateResult = await this.options.authorizationGate.execute({
          tool,
          input,
          agentId,
          sessionId,
          userId,
          runId,
        });
        context.status = gateResult.success
          ? ToolExecutionStatus.COMPLETED
          : gateResult.pendingApproval
            ? ToolExecutionStatus.PENDING
            : ToolExecutionStatus.FAILED;
        context.completedAt = new Date();
        context.duration = gateResult.duration;
        if (gateResult.success) {
          this.emitEvent(AgentEventType.TOOL_EXECUTION_COMPLETED, {
            toolName: tool.name,
            output: gateResult.output,
            duration: gateResult.duration,
          });
        } else if (gateResult.pendingApproval) {
          this.emitEvent(AgentEventType.TOOL_APPROVAL_REQUESTED, {
            toolName: tool.name,
            requestId: gateResult.requestId,
            input,
          });
        } else {
          this.emitEvent(AgentEventType.TOOL_EXECUTION_FAILED, {
            toolName: tool.name,
            input,
            error: gateResult.error?.message ?? 'Authorization gate denied',
            duration: gateResult.duration,
          });
        }
        return gateResult;
      }

      if (this.options.policyService) {
        this.options.policyService.setIdentity(this.options.agentIdentity);
        const decision = this.options.policyService.evaluateTool(tool.name, input, tool.capability);
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
      } else if (this.options.policyEngine) {
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

      if (
        !opts?.skipApproval &&
        (tool.requiresApproval || this.toolRequiresApprovalDecorator(tool))
      ) {
        if (!tool.requiresApproval) {
          tool = { ...tool, requiresApproval: true };
        }
        const { promise, requestId } = await this.requestApproval(
          tool,
          input,
          agentId,
          executionId,
          runId
        );

        if (this.options.durableSuspend) {
          context.status = ToolExecutionStatus.PENDING;
          context.duration = Date.now() - startTime;
          return {
            success: false,
            pendingApproval: true,
            requestId,
            duration: context.duration,
            metadata: { toolName: tool.name, input, runId },
          };
        }

        const approved = await promise;

        if (this.options.onApprovalResolved) {
          await this.options.onApprovalResolved({ runId, requestId, approved });
        }

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

      if (this.options.effectGate) {
        const effectDecision = await this.options.effectGate.beforeToolExecute({
          executionId,
          runId: runId ?? executionId,
          branchId: context.metadata?.branchId as string | undefined,
          agentId,
          sessionId,
          userId,
          tool,
          input,
        });

        if (!effectDecision.allow) {
          context.status = ToolExecutionStatus.FAILED;
          context.completedAt = new Date();
          context.duration = Date.now() - startTime;
          const errorMsg =
            effectDecision.reason ??
            (effectDecision.barrier
              ? 'Irreversible tool blocked in speculative branch'
              : 'Effect gate denied tool execution');

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
            metadata: {
              effectKind: effectDecision.effectKind,
              barrier: effectDecision.barrier,
              abortSpeculation: effectDecision.abortSpeculation,
            },
          };
        }

        if (effectDecision.deferred) {
          context.status = ToolExecutionStatus.COMPLETED;
          context.completedAt = new Date();
          context.duration = Date.now() - startTime;

          this.emitEvent(AgentEventType.TOOL_EXECUTION_COMPLETED, {
            toolName: tool.name,
            input,
            output: effectDecision.predictedOutput,
            duration: context.duration,
          });

          return {
            success: true,
            output: effectDecision.predictedOutput,
            duration: context.duration,
            metadata: { deferred: true, effectKind: effectDecision.effectKind },
          };
        }
      }

      context.status = ToolExecutionStatus.EXECUTING;

      const result = await this.executeWithRetry(tool, input, tool.retries || 0);

      if (this.options.effectGate) {
        await this.options.effectGate.afterToolExecute({
          executionId,
          runId: runId ?? executionId,
          branchId: context.metadata?.branchId as string | undefined,
          agentId,
          sessionId,
          userId,
          tool,
          input,
          output: result,
        });
      }

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
      // Prefer the live instance method so @Delegate patches (and other runtime
      // replacements on tool.target[propertyKey]) are honored. tool.method is the
      // prototype function captured at decorate time.
      const target = tool.target as Record<string, unknown> | undefined;
      const live =
        target && typeof target[tool.propertyKey] === 'function'
          ? (target[tool.propertyKey] as (...args: unknown[]) => unknown)
          : tool.method;
      const result = await Promise.race([
        live.call(tool.target, input),
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
    executionId: string,
    runId?: string
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
      metadata: runId ? { runId } : undefined,
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
      runId,
    });

    if (this.options.onApprovalRequested) {
      await this.options.onApprovalRequested({
        runId,
        requestId,
        toolName: tool.name,
        input,
      });
    }

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

  /** Honor `@RequiresApproval()` in addition to `@Tool({ requiresApproval })`. */
  private toolRequiresApprovalDecorator(tool: ToolMetadata): boolean {
    try {
      return Boolean(getApprovalMetadata(tool.target, tool.propertyKey));
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async unwrap<T>(value: T | Promise<T>): Promise<T> {
    return value instanceof Promise ? await value : value;
  }
}
