/**
 * AgentGatekeeper — runtime authorization boundary for agent tool invocations.
 *
 * Every tool call authorized before execution.
 */

import {
  GatekeeperApprovalRequiredError,
  GatekeeperDeniedError,
  GatekeeperExecutionError,
  GatekeeperPolicyError,
  GatekeeperValidationError,
} from './errors';
import { BudgetTracker } from './budget/tracker';
import {
  buildApprovalRequest,
  InMemoryApprovalProvider,
  type ApprovalProvider,
} from './approval/provider';
import {
  ConsoleAuditSink,
  decisionEventType,
  GatekeeperMetrics,
  sanitizeContextForAudit,
  type AuditSink,
} from './audit/sink';
import { buildArgumentSummary, evaluatePolicies, safeClone } from './policy/engine';
import {
  defaultClock,
  defaultIdGenerator,
  invocationFingerprint,
  redactObject as redactFields,
  sanitizeErrorMessage,
} from './security';
import type {
  AgentGatekeeperOptions,
  AgentGatekeeperPolicy,
  GatekeeperDecision,
  GatekeeperExecuteInput,
  GatekeeperExecuteResult,
  GatekeeperSimulation,
  PolicyEvaluationContext,
  ProtectedTool,
  ToolInvocationContext,
} from './types';

export class AgentGatekeeper {
  readonly mode: NonNullable<AgentGatekeeperOptions['mode']>;
  readonly defaultDecision: NonNullable<AgentGatekeeperOptions['defaultDecision']>;
  readonly policies: AgentGatekeeperPolicy[];
  readonly approvalProvider: ApprovalProvider;
  readonly auditSink: AuditSink;
  readonly auditCritical: boolean;
  readonly clock: NonNullable<AgentGatekeeperOptions['clock']>;
  readonly idGenerator: NonNullable<AgentGatekeeperOptions['idGenerator']>;
  readonly policyTimeoutMs: number;
  readonly maxRewritePasses: number;
  readonly budgetTracker: BudgetTracker;
  readonly metrics: GatekeeperMetrics;

  constructor(options: AgentGatekeeperOptions = {}) {
    this.mode = options.mode ?? 'enforce';
    this.defaultDecision = options.defaultDecision ?? 'deny';
    this.policies = options.policies ?? [];
    this.approvalProvider =
      options.approvalProvider ??
      new InMemoryApprovalProvider({
        clock: options.clock,
        idGenerator: options.idGenerator,
      });
    this.auditSink = options.auditSink ?? new ConsoleAuditSink();
    this.auditCritical = options.audit?.critical ?? this.mode === 'enforce';
    this.clock = options.clock ?? defaultClock();
    this.idGenerator = options.idGenerator ?? defaultIdGenerator();
    this.policyTimeoutMs = options.policyTimeoutMs ?? 5000;
    this.maxRewritePasses = options.maxRewritePasses ?? 1;
    this.budgetTracker = new BudgetTracker();
    this.metrics = new GatekeeperMetrics();
  }

  /** Evaluate policies without executing a tool. */
  async evaluate<TIn = unknown>(
    context: ToolInvocationContext<TIn>,
    classification?: import('./types').ToolClassification
  ): Promise<GatekeeperDecision<TIn>> {
    const result = await this.evaluateInternal(context, classification, 0, false);
    return result.decision;
  }

  /** Explain matched policies and expected decision — never executes or creates approvals. */
  async simulate<TIn = unknown>(
    context: ToolInvocationContext<TIn>,
    classification?: import('./types').ToolClassification
  ): Promise<GatekeeperSimulation> {
    const evalCtx: PolicyEvaluationContext<TIn> = {
      context,
      input: context.input,
      classification,
    };
    const result = await evaluatePolicies<TIn>({
      policies: this.policies as AgentGatekeeperPolicy<TIn>[],
      evalCtx,
      mode: this.mode === 'disabled' ? 'disabled' : 'enforce',
      defaultDecision: this.defaultDecision,
      budgetTracker: this.budgetTracker,
      nowMs: this.clock.now().getTime(),
      policyTimeoutMs: this.policyTimeoutMs,
      rewritePass: 0,
      maxRewritePasses: this.maxRewritePasses,
    });

    let decision = result.decision;
    if (decision.outcome === 'require_approval') {
      decision = {
        outcome: 'require_approval',
        policyIds: decision.policyIds,
        reason: decision.reason,
        approvalRequest: buildApprovalRequest(
          {
            invocationId: context.invocationId,
            runId: context.runId,
            agentId: context.agentId,
            agentVersion: context.agentVersion,
            tenantId: context.tenantId,
            delegatedUserId: context.delegatedUserId,
            toolName: context.toolName,
            input: context.input as Record<string, unknown>,
            reason: decision.reason,
            policyIds: decision.policyIds,
            policyVersions: this.policyVersions(decision.policyIds),
            riskClassification: classification === 'destructive' ? 'critical' : 'medium',
            idempotencyKey: context.idempotencyKey ?? context.invocationId,
          },
          this.clock,
          () => 'simulated-approval-id',
          300_000
        ),
      };
    }

    return {
      decision,
      matchedPolicies: result.matchedPolicies,
      explanation: result.explanation,
      sanitizedContext: sanitizeContextForAudit(context),
      sanitizedInput: buildArgumentSummary(context.input),
    };
  }

  /** Evaluate and execute a protected tool when allowed. */
  async execute<TIn = unknown, TOut = unknown>(
    input: GatekeeperExecuteInput<TIn, TOut>
  ): Promise<GatekeeperExecuteResult<TOut>> {
    const start = this.clock.now().getTime();
    let context = safeClone(input.context) as ToolInvocationContext<TIn>;
    const tool = input.tool;
    let originalInputSnapshot: Record<string, unknown> | undefined;

    await this.emitAudit({
      type: 'gatekeeper.evaluation.started',
      timestamp: this.clock.now().toISOString(),
      invocationId: context.invocationId,
      runId: context.runId,
      agentId: context.agentId,
      tenantId: context.tenantId,
      toolName: context.toolName,
      environment: context.environment,
      classification: tool.classification,
    });

    const evalResult = await this.evaluateInternal(context, tool.classification, 0, true);
    let decision = evalResult.decision;

    if (decision.outcome === 'rewrite') {
      originalInputSnapshot = redactFields(
        context.input as Record<string, unknown>,
        tool.redactFields
      );
      context = { ...context, input: decision.safeInput };
      const reEval = await this.evaluateInternal(context, tool.classification, 1, true);
      decision = reEval.decision;
    }

    await this.emitAudit({
      type: decisionEventType(decision),
      timestamp: this.clock.now().toISOString(),
      invocationId: context.invocationId,
      runId: context.runId,
      agentId: context.agentId,
      tenantId: context.tenantId,
      toolName: context.toolName,
      environment: context.environment,
      decision: decision.outcome,
      policyIds: decision.policyIds,
      classification: tool.classification,
      denialCode: decision.outcome === 'deny' ? decision.code : undefined,
      reason:
        decision.outcome !== 'allow'
          ? 'reason' in decision
            ? decision.reason
            : undefined
          : undefined,
    });

    this.metrics.recordDecision(
      decision.outcome,
      decision.outcome === 'deny' ? decision.code : undefined
    );

    if (decision.outcome === 'deny') {
      if (this.mode === 'audit') {
        // audit mode still executes unless validation fails — but deny from structural issues still blocks
      } else {
        throw new GatekeeperDeniedError(sanitizeErrorMessage(decision.reason), {
          policyIds: decision.policyIds,
          invocationId: context.invocationId,
          toolName: context.toolName,
        });
      }
    }

    if (decision.outcome === 'require_approval') {
      if (this.mode === 'audit') {
        // continue in audit mode
      } else {
        const approvalReq = decision.approvalRequest;
        if (context.approvalToken) {
          const fp = invocationFingerprint({
            agentId: context.agentId,
            toolName: context.toolName,
            input: context.input,
            tenantId: context.tenantId,
          });
          const consumed = await this.approvalProvider.consume(context.approvalToken, fp);
          if (!consumed.valid) {
            throw new GatekeeperDeniedError(
              sanitizeErrorMessage(consumed.reason ?? 'Invalid approval'),
              {
                policyIds: decision.policyIds,
                invocationId: context.invocationId,
                toolName: context.toolName,
              }
            );
          }
          await this.emitAudit({
            type: 'gatekeeper.approval.resolved',
            timestamp: this.clock.now().toISOString(),
            invocationId: context.invocationId,
            runId: context.runId,
            agentId: context.agentId,
            tenantId: context.tenantId,
            toolName: context.toolName,
            environment: context.environment,
            metadata: { approvalId: context.approvalToken, status: 'consumed' },
          });
        } else {
          const created = await this.approvalProvider.create(approvalReq);
          throw new GatekeeperApprovalRequiredError(
            sanitizeErrorMessage(created.reason),
            created.approvalId,
            {
              policyIds: decision.policyIds,
              invocationId: context.invocationId,
              toolName: context.toolName,
            }
          );
        }
      }
    }

    // Validate input schema
    if (tool.inputSchema) {
      const parsed = await tool.inputSchema.safeParseAsync(context.input);
      if (!parsed.success) {
        throw new GatekeeperValidationError(
          sanitizeErrorMessage(`Input validation failed: ${parsed.error.message}`),
          { invocationId: context.invocationId, toolName: context.toolName }
        );
      }
      context = { ...context, input: parsed.data as TIn };
    }

    if (this.mode === 'disabled') {
      const output = await this.runTool(tool, context);
      return {
        decision: { outcome: 'allow', policyIds: [], reason: 'Gatekeeper disabled' },
        output,
        durationMs: this.clock.now().getTime() - start,
        originalInputSnapshot,
      };
    }

    if (decision.outcome === 'deny' && this.mode === 'audit') {
      // audit mode: log deny but continue
      decision = { outcome: 'allow', policyIds: decision.policyIds, reason: 'Audit mode override' };
    }

    const toolStart = this.clock.now().getTime();
    await this.emitAudit({
      type: 'gatekeeper.tool.started',
      timestamp: this.clock.now().toISOString(),
      invocationId: context.invocationId,
      runId: context.runId,
      agentId: context.agentId,
      tenantId: context.tenantId,
      toolName: context.toolName,
      environment: context.environment,
      classification: tool.classification,
    });

    try {
      let output: TOut = await this.runTool(tool, context);

      if (tool.outputSchema) {
        const parsed = await tool.outputSchema.safeParseAsync(output);
        if (!parsed.success) {
          throw new GatekeeperValidationError(
            sanitizeErrorMessage(`Output validation failed: ${parsed.error.message}`),
            { invocationId: context.invocationId, toolName: context.toolName }
          );
        }
        output = parsed.data;
      }

      if (tool.redactFields?.length && output && typeof output === 'object') {
        output = redactFields(output as Record<string, unknown>, tool.redactFields) as TOut;
      }

      const toolDuration = this.clock.now().getTime() - toolStart;
      this.metrics.recordToolLatency(toolDuration);

      await this.emitAudit({
        type: 'gatekeeper.tool.completed',
        timestamp: this.clock.now().toISOString(),
        invocationId: context.invocationId,
        runId: context.runId,
        agentId: context.agentId,
        tenantId: context.tenantId,
        toolName: context.toolName,
        environment: context.environment,
        durationMs: toolDuration,
        classification: tool.classification,
      });

      return {
        decision,
        output,
        durationMs: this.clock.now().getTime() - start,
        originalInputSnapshot,
      };
    } catch (err) {
      if (
        err instanceof GatekeeperValidationError ||
        err instanceof GatekeeperDeniedError ||
        err instanceof GatekeeperApprovalRequiredError
      ) {
        throw err;
      }
      const toolDuration = this.clock.now().getTime() - toolStart;
      await this.emitAudit({
        type: 'gatekeeper.tool.failed',
        timestamp: this.clock.now().toISOString(),
        invocationId: context.invocationId,
        runId: context.runId,
        agentId: context.agentId,
        tenantId: context.tenantId,
        toolName: context.toolName,
        environment: context.environment,
        durationMs: toolDuration,
        reason: sanitizeErrorMessage(err instanceof Error ? err.message : 'Tool execution failed'),
        classification: tool.classification,
      });
      throw new GatekeeperExecutionError(
        sanitizeErrorMessage('Tool execution failed'),
        { invocationId: context.invocationId, toolName: context.toolName },
        err instanceof Error ? err : undefined
      );
    }
  }

  private async evaluateInternal<TIn>(
    context: ToolInvocationContext<TIn>,
    classification: import('./types').ToolClassification | undefined,
    rewritePass: number,
    buildApproval: boolean
  ): Promise<{ decision: GatekeeperDecision<TIn> }> {
    const evalStart = this.clock.now().getTime();
    const evalCtx: PolicyEvaluationContext<TIn> = {
      context,
      input: context.input,
      classification,
    };

    const result = await evaluatePolicies<TIn>({
      policies: this.policies as AgentGatekeeperPolicy<TIn>[],
      evalCtx,
      mode: this.mode,
      defaultDecision: this.defaultDecision,
      budgetTracker: this.budgetTracker,
      nowMs: this.clock.now().getTime(),
      policyTimeoutMs: this.policyTimeoutMs,
      rewritePass,
      maxRewritePasses: this.maxRewritePasses,
    });

    this.metrics.recordEvaluationLatency(this.clock.now().getTime() - evalStart);

    let decision = result.decision;

    if (decision.outcome === 'require_approval' && buildApproval) {
      const approvalReq = buildApprovalRequest(
        {
          invocationId: context.invocationId,
          runId: context.runId,
          agentId: context.agentId,
          agentVersion: context.agentVersion,
          tenantId: context.tenantId,
          delegatedUserId: context.delegatedUserId,
          toolName: context.toolName,
          input: context.input as Record<string, unknown>,
          reason: decision.reason,
          policyIds: decision.policyIds,
          policyVersions: this.policyVersions(decision.policyIds),
          riskClassification:
            classification === 'destructive'
              ? 'critical'
              : classification === 'write'
                ? 'high'
                : 'medium',
          idempotencyKey: context.idempotencyKey ?? context.invocationId,
        },
        this.clock,
        this.idGenerator,
        300_000
      );
      decision = {
        outcome: 'require_approval',
        policyIds: decision.policyIds,
        reason: decision.reason,
        approvalRequest: approvalReq,
      };
    }

    return { decision };
  }

  private policyVersions(policyIds: string[]): string[] {
    return policyIds.map((id) => this.policies.find((p) => p.id === id)?.version ?? 'unknown');
  }

  private async runTool<TIn, TOut>(
    tool: ProtectedTool<TIn, TOut>,
    context: ToolInvocationContext<TIn>
  ): Promise<TOut> {
    return tool.execute(context.input, context);
  }

  private async emitAudit(event: import('./audit/sink').GatekeeperAuditEvent): Promise<void> {
    try {
      await this.auditSink.emit(event);
    } catch (err) {
      if (this.auditCritical && this.mode === 'enforce') {
        throw new GatekeeperPolicyError(
          sanitizeErrorMessage('Audit sink failure'),
          {},
          err instanceof Error ? err : undefined
        );
      }
    }
  }
}
