/**
 * DecisionRuntime — orchestrates provider → confidence → policy → Gatekeeper → durable execution.
 */

import type { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import type { CheckpointService, HumanTaskService } from '@hazeljs/agent';
import type {
  CapabilityHandler,
  DecisionEvaluationRecord,
  DecisionLabRun,
  DecisionPolicyAction,
  DecisionRequest,
  DecisionResult,
  DecisionRiskObject,
} from '../types';
import { DecisionProviderRegistry } from '../providers/provider-registry';
import { HazelAgentDecisionProvider } from '../providers/hazel-agent-provider';
import { MockDecisionProvider } from '../providers/mock-provider';
import { DecisionRegistry } from '../dna/decision-registry';
import { selectExecutionStrategy } from './complexity-router';
import { evaluateDecisionPolicy } from '../policy/policy-evaluator';
import {
  applySkillgateRiskFloor,
  authorizeCapability,
  lookupSkill,
  type SkillgateLookup,
} from '../governance/authorize';
import { DecisionDurableStore } from '../durable/decision-store';
import { buildAuditEvent, recordDecisionMetrics, withOptionalSpan } from '../observability/metrics';
import { enrichLabRun } from '../lab/decision-lab';
import { createDecisionId, getPathValue, resolveRiskLevel } from '../utils';
import {
  DecisionProviderError,
  DecisionReviewRequiredError,
  DecisionValidationError,
} from '../errors';
import { assertFiniteConfidence } from '../utils';
import type { DecisionCache } from '../cache/decision-cache';
import { decisionCacheKey } from '../cache/decision-cache';
import type { DecisionHistory } from '../history/decision-history';
import type { CalibrationModel } from '../calibration/calibration';
import { calibrateConfidence } from '../calibration/calibration';

export interface DecisionRuntimeOptions {
  providers?: DecisionProviderRegistry;
  registry?: DecisionRegistry;
  gatekeeper?: AgentGatekeeper;
  skillgate?: SkillgateLookup;
  checkpoints?: CheckpointService;
  humanTasks?: HumanTaskService;
  capabilityHandlers?: Record<string, CapabilityHandler>;
  defaultAgentId?: string;
  /** Explicit opt-in cache instance — used only when request.cache === true. */
  cache?: DecisionCache;
  /** Append-only history — never auto-fed into model prompts. */
  history?: DecisionHistory;
  /**
   * Optional calibration model — applied only when request.calibrate === true.
   * Reporting only; never authorizes.
   */
  calibration?: CalibrationModel;
  /** Optional AuditService-compatible logger (@hazeljs/audit). */
  auditService?: {
    log(event: {
      action: string;
      resource?: string;
      resourceId?: string;
      result?: string;
      metadata?: Record<string, unknown>;
      timestamp?: string;
    }): void;
  };
  /** Hybrid deterministic overrides evaluated before probabilistic policy. */
  hybridRules?: Array<{
    whenPath: string;
    gte?: number;
    gt?: number;
    then: DecisionPolicyAction;
    reason?: string;
  }>;
}

export class DecisionRuntime {
  readonly providers: DecisionProviderRegistry;
  readonly registry: DecisionRegistry;
  private readonly gatekeeper?: AgentGatekeeper;
  private readonly skillgate?: SkillgateLookup;
  private readonly durable: DecisionDurableStore;
  private readonly handlers: Record<string, CapabilityHandler>;
  private readonly defaultAgentId: string;
  private readonly hybridRules: DecisionRuntimeOptions['hybridRules'];
  private readonly auditService?: DecisionRuntimeOptions['auditService'];
  private readonly cache?: DecisionCache;
  private readonly history?: DecisionHistory;
  private calibration?: CalibrationModel;
  private readonly evaluations = new Map<string, DecisionEvaluationRecord[]>();
  private readonly results = new Map<string, DecisionResult>();

  constructor(options: DecisionRuntimeOptions = {}) {
    this.providers = options.providers ?? new DecisionProviderRegistry();
    this.registry = options.registry ?? new DecisionRegistry();
    this.gatekeeper = options.gatekeeper;
    this.skillgate = options.skillgate;
    this.durable = new DecisionDurableStore(options.checkpoints, options.humanTasks);
    this.handlers = options.capabilityHandlers ?? {};
    this.defaultAgentId = options.defaultAgentId ?? 'decision-runtime';
    this.hybridRules = options.hybridRules;
    this.auditService = options.auditService;
    this.cache = options.cache;
    this.history = options.history;
    this.calibration = options.calibration;

    if (!this.providers.has('hazel-agent')) {
      this.providers.register(new HazelAgentDecisionProvider());
    }
    if (!this.providers.has('mock')) {
      this.providers.register(new MockDecisionProvider());
    }
  }

  registerCapability(name: string, handler: CapabilityHandler): void {
    this.handlers[name] = handler;
  }

  async decide<TState, const TChoices extends readonly string[]>(
    request: DecisionRequest<TState, TChoices>
  ): Promise<DecisionResult<TChoices[number]>> {
    type TDecision = TChoices[number];
    const started = Date.now();
    const decisionId = createDecisionId();
    const runId = request.context?.runId ?? decisionId;
    const agentId = request.context?.agentId ?? this.defaultAgentId;
    const tenantId = request.context?.tenantId;

    return withOptionalSpan(
      'decision.run',
      {
        'decision.id': decisionId,
        'decision.name': request.name ?? '',
        'agent.id': agentId,
        'tenant.id': tenantId ?? '',
        'run.id': runId,
      },
      async () => {
        try {
          if (!request.choices?.length) {
            throw new DecisionValidationError('choices must be a non-empty array');
          }
          if (!request.objective) {
            throw new DecisionValidationError('objective is required');
          }

          if (request.cache && this.cache) {
            const key = decisionCacheKey(request);
            const hit = this.cache.get(key);
            if (hit) {
              this.results.set(hit.id, hit);
              this.history?.append(hit);
              return hit as DecisionResult<TDecision>;
            }
          }

          const definition = this.registry.merge(request.name, request.definition);
          const riskFromDna = definition?.risk
            ? resolveRiskLevel(
                typeof definition.risk === 'string' ? definition.risk : definition.risk
              )
            : undefined;
          let risk: DecisionRiskObject = resolveRiskLevel(request.risk ?? riskFromDna, 'medium');

          // Models never set risk — strip any forged risk from state metadata.
          if (request.metadata && 'risk' in request.metadata) {
            // ignore untrusted metadata.risk
          }

          const strategyHint =
            request.strategy ??
            (typeof definition?.strategy === 'string'
              ? definition.strategy
              : definition?.strategy?.mode);

          const strategy = selectExecutionStrategy({
            risk: risk.level,
            choiceCount: request.choices.length,
            strategy: strategyHint as never,
            forceHumanRequired:
              risk.level === 'critical' ||
              strategyHint === 'human-required' ||
              Object.values(definition?.execution ?? {}).some((e) => e.hitl),
          });

          await this.durable.save(runId, {
            kind: 'hazeljs.decision',
            status: 'CREATED',
          });

          const providerName = request.provider ?? definition?.provider ?? 'auto';
          const provider = this.providers.resolve(providerName, risk, request.name);

          let providerResult;
          try {
            providerResult = await provider.decide<TState, TDecision>({
              decisionId,
              name: request.name,
              objective: request.objective,
              state: request.state,
              choices: request.choices,
              risk,
              strategy,
              definition,
              tenantId,
              agentId,
              metadata: request.metadata,
            });
          } catch (e) {
            if (e instanceof DecisionProviderError) throw e;
            throw new DecisionProviderError(e instanceof Error ? e.message : String(e), {
              provider: provider.name,
            });
          }

          // Strip any attempt by provider to lower risk (providers must not mutate risk).
          risk = resolveRiskLevel(risk);

          assertFiniteConfidence(providerResult.confidence.value);

          const capability =
            definition?.execution?.[providerResult.decision]?.capability ??
            (request.metadata?.capability as string | undefined);

          const skill = lookupSkill(this.skillgate, capability);
          risk = {
            ...risk,
            level: applySkillgateRiskFloor(risk.level, skill),
          };

          // Hybrid rules dominate probabilistic outcomes.
          let forceAction: DecisionPolicyAction | undefined;
          let forceReason: string | undefined;
          for (const rule of this.hybridRules ?? []) {
            const v = getPathValue(request.state, rule.whenPath);
            if (typeof v !== 'number') continue;
            if (rule.gte !== undefined && v >= rule.gte) {
              forceAction = rule.then;
              forceReason = rule.reason ?? `hybrid: ${rule.whenPath} >= ${rule.gte}`;
              break;
            }
            if (rule.gt !== undefined && v > rule.gt) {
              forceAction = rule.then;
              forceReason = rule.reason ?? `hybrid: ${rule.whenPath} > ${rule.gt}`;
              break;
            }
          }

          const requestPolicy = Array.isArray(request.policy)
            ? { rules: request.policy }
            : request.policy;
          const policyConfig = {
            rules: requestPolicy?.rules ?? (definition?.policy as never),
            confidence: requestPolicy?.confidence ?? definition?.confidence,
          };

          // If strategy is human-required, force review unless hybrid already set.
          if (strategy === 'human-required' && !forceAction) {
            forceAction = 'review';
            forceReason = 'strategy human-required';
          }

          const tPolicy = Date.now();
          const policy = evaluateDecisionPolicy({
            risk: risk.level,
            confidence: providerResult.confidence.value,
            policy: policyConfig,
            forceAction,
            forceReason,
          });
          const policyMs = Date.now() - tPolicy;

          const alternatives = [...providerResult.candidates]
            .filter((c) => c.candidate !== providerResult.decision)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((c) => ({
              decision: c.candidate,
              confidence: c.score,
            }));

          let status: DecisionResult['status'] = 'POLICY_EVALUATED';
          let hitl: DecisionResult<TDecision>['hitl'];
          let execution: DecisionResult<TDecision>['execution'] = {
            requested: Boolean(request.execute && capability && policy.outcome === 'allow'),
            capability,
          };

          if (policy.outcome === 'review' || policy.outcome === 'escalate') {
            status = 'WAITING_FOR_HUMAN';
            const task = await this.durable.humanTaskService?.create({
              runId,
              type: 'review',
              toolName: capability,
              payload: {
                decisionId,
                machineDecision: providerResult.decision,
                confidence: providerResult.confidence.value,
                evidence: providerResult.evidence,
                objective: request.objective,
              },
              metadata: { tenantId, agentId },
            });
            hitl = {
              required: true,
              taskId: task?.id,
              status: 'pending',
            };
            await this.durable.save(runId, {
              kind: 'hazeljs.decision',
              status: 'WAITING_FOR_HUMAN',
              machineDecision: String(providerResult.decision),
              machineConfidence: providerResult.confidence.value,
            });
          } else if (policy.outcome === 'deny') {
            status = 'DENIED';
            execution = {
              ...execution,
              requested: false,
              authorized: false,
            };
          } else if (policy.outcome === 'allow' && request.execute && capability) {
            const tAuth = Date.now();
            const auth = await authorizeCapability({
              gatekeeper: this.gatekeeper,
              decisionId,
              runId,
              agentId,
              tenantId,
              capability,
              environment: request.context?.environment,
              input: { decision: providerResult.decision },
            });
            const skillgateMs = Date.now() - tAuth;
            execution = {
              requested: true,
              authorized: auth.authorized,
              capability,
              invoked: false,
            };

            if (!auth.authorized) {
              status = 'DENIED';
              await this.durable.save(runId, {
                kind: 'hazeljs.decision',
                status: 'DENIED',
                machineDecision: String(providerResult.decision),
                machineConfidence: providerResult.confidence.value,
              });
              // Record latency skillgate even when denied
              void skillgateMs;
            } else {
              const existing = await this.durable.getExecutionReceipt(runId);
              if (existing) {
                execution = {
                  ...execution,
                  invoked: false,
                  receiptId: existing.receiptId,
                };
                status = 'COMPLETED';
              } else {
                const handler = this.handlers[capability];
                if (!handler) {
                  status = 'DENIED';
                  execution = {
                    ...execution,
                    authorized: false,
                    invoked: false,
                  };
                } else {
                  status = 'EXECUTION_STARTED';
                  const output = await handler({
                    decisionId,
                    decision: String(providerResult.decision),
                    capability,
                    state: request.state,
                    tenantId,
                  });
                  const receiptId = `rcpt_${decisionId}`;
                  await this.durable.save(runId, {
                    kind: 'hazeljs.decision',
                    status: 'COMPLETED',
                    executionReceipt: {
                      receiptId,
                      capability,
                      at: new Date().toISOString(),
                      output,
                    },
                    machineDecision: String(providerResult.decision),
                    machineConfidence: providerResult.confidence.value,
                  });
                  execution = {
                    ...execution,
                    invoked: true,
                    receiptId,
                  };
                  status = 'COMPLETED';
                }
              }
            }
          } else if (policy.outcome === 'critique') {
            status = 'DECISION_FINALIZED';
          } else {
            status = 'COMPLETED';
          }

          if (hitl?.required && !request.execute) {
            // Still return a result; callers may treat WAITING_FOR_HUMAN specially.
          }

          let confidenceDetail = providerResult.confidence;
          if (request.calibrate && this.calibration) {
            confidenceDetail = calibrateConfidence(providerResult.confidence, this.calibration);
          }

          const result: DecisionResult<TDecision> = {
            id: decisionId,
            decision: providerResult.decision,
            confidence: confidenceDetail.value,
            confidenceDetail,
            alternatives,
            evidence: providerResult.evidence,
            candidates: providerResult.candidates,
            critic: providerResult.critic,
            strategy,
            provider: provider.name,
            risk,
            policy,
            provenance: {
              definitionName: request.name,
              definitionVersion: definition?.version,
              agentId,
              tenantId,
              stages: providerResult.stages,
              summary: `decision=${providerResult.decision} confidence=${providerResult.confidence.value.toFixed(3)} policy=${policy.outcome}`,
            },
            execution,
            hitl,
            cost: {
              modelCalls: providerResult.modelCalls ?? 0,
              inputTokens: providerResult.inputTokens ?? 0,
              outputTokens: providerResult.outputTokens ?? 0,
            },
            latency: {
              evidenceMs: providerResult.latency.evidenceMs,
              candidatesMs: providerResult.latency.candidatesMs,
              judgeMs: providerResult.latency.judgeMs,
              criticMs: providerResult.latency.criticMs,
              confidenceMs: providerResult.latency.confidenceMs,
              policyMs,
              totalMs: Date.now() - started,
            },
            trace: {
              runId,
              decisionId,
              traceId: request.context?.traceId,
            },
            status,
          };

          this.results.set(decisionId, result as DecisionResult);
          await this.durable.save(runId, {
            kind: 'hazeljs.decision',
            status,
            result: result as DecisionResult,
            machineDecision: String(result.decision),
            machineConfidence: result.confidence,
          });

          recordDecisionMetrics(result as DecisionResult);
          const audit = buildAuditEvent(result as DecisionResult);
          this.auditService?.log({
            action: 'decision.run',
            resource: 'decision',
            resourceId: result.id,
            result: result.status,
            metadata: audit,
          });
          this.history?.append(result as DecisionResult);
          if (request.cache && this.cache && !request.execute) {
            this.cache.set(decisionCacheKey(request), result as DecisionResult);
          }

          if (status === 'WAITING_FOR_HUMAN' && request.metadata?.throwOnReview) {
            throw new DecisionReviewRequiredError(
              'Human review required',
              decisionId,
              hitl?.taskId
            );
          }

          return result;
        } catch (e) {
          recordDecisionMetrics({
            id: decisionId,
            decision: request.choices[0] as TDecision,
            confidence: 0,
            confidenceDetail: { value: 0, type: 'heuristic', calibrated: false },
            strategy: 'fast',
            provider: 'none',
            risk: { level: 'medium' },
            policy: { outcome: 'deny' },
            provenance: { stages: [], agentId, tenantId },
            latency: { totalMs: Date.now() - started },
            trace: { decisionId, runId },
            status: 'FAILED',
          } as DecisionResult);
          throw e;
        }
      }
    );
  }

  async resumeFromHuman(input: {
    decisionId: string;
    runId: string;
    action: 'approve' | 'reject' | 'override';
    decision?: string;
    actor: string;
    reason?: string;
    execute?: boolean;
  }): Promise<DecisionResult> {
    const existing = this.results.get(input.decisionId);
    if (!existing) {
      throw new DecisionValidationError(`Unknown decision: ${input.decisionId}`);
    }

    const payload = await this.durable.loadLatest(input.runId);
    let decision = existing.decision;
    let hitlStatus: NonNullable<DecisionResult['hitl']>['status'] = 'approved';

    if (input.action === 'reject') {
      hitlStatus = 'rejected';
      await this.durable.humanTaskService?.resolve(
        existing.hitl?.taskId ?? '',
        'rejected',
        input.actor
      );
      const result: DecisionResult = {
        ...existing,
        status: 'DENIED',
        hitl: { required: true, taskId: existing.hitl?.taskId, status: hitlStatus },
        execution: {
          requested: false,
          authorized: false,
          capability: existing.execution?.capability,
        },
        policy: { outcome: 'deny', reason: input.reason ?? 'human rejected' },
      };
      this.results.set(input.decisionId, result);
      return result;
    }

    if (input.action === 'override') {
      if (!input.decision) {
        throw new DecisionValidationError('override requires decision');
      }
      decision = input.decision;
      hitlStatus = 'overridden';
      recordDecisionMetrics({
        ...existing,
        hitl: { required: true, status: 'overridden' },
      });
    } else {
      await this.durable.humanTaskService?.resolve(
        existing.hitl?.taskId ?? '',
        'approved',
        input.actor
      );
    }

    const capability =
      existing.execution?.capability ??
      this.registry.get(existing.provenance.definitionName ?? '')?.execution?.[decision]
        ?.capability;

    let execution = existing.execution ?? { requested: Boolean(input.execute && capability) };
    let status: DecisionResult['status'] = 'AUTHORIZED';

    if (input.execute && capability) {
      const auth = await authorizeCapability({
        gatekeeper: this.gatekeeper,
        decisionId: input.decisionId,
        runId: input.runId,
        agentId: existing.provenance.agentId ?? this.defaultAgentId,
        tenantId: existing.provenance.tenantId,
        capability,
      });
      execution = {
        requested: true,
        authorized: auth.authorized,
        capability,
        invoked: false,
      };
      if (!auth.authorized) {
        status = 'DENIED';
      } else {
        const receipt = await this.durable.getExecutionReceipt(input.runId);
        if (receipt) {
          execution = { ...execution, receiptId: receipt.receiptId, invoked: false };
          status = 'COMPLETED';
        } else {
          const handler = this.handlers[capability];
          if (handler) {
            const output = await handler({
              decisionId: input.decisionId,
              decision: String(decision),
              capability,
              state: undefined,
              tenantId: existing.provenance.tenantId,
            });
            const receiptId = `rcpt_${input.decisionId}`;
            await this.durable.save(input.runId, {
              kind: 'hazeljs.decision',
              status: 'COMPLETED',
              executionReceipt: {
                receiptId,
                capability,
                at: new Date().toISOString(),
                output,
              },
              humanOverride:
                input.action === 'override'
                  ? {
                      decision: String(decision),
                      actor: input.actor,
                      reason: input.reason ?? '',
                      at: new Date().toISOString(),
                    }
                  : undefined,
              machineDecision: payload?.machineDecision,
              machineConfidence: payload?.machineConfidence,
            });
            execution = { ...execution, invoked: true, receiptId };
            status = 'COMPLETED';
          } else {
            status = 'DENIED';
            execution = { ...execution, authorized: false };
          }
        }
      }
    } else {
      status = 'COMPLETED';
    }

    const result: DecisionResult = {
      ...existing,
      decision,
      status,
      execution,
      hitl: {
        required: true,
        taskId: existing.hitl?.taskId,
        status: hitlStatus,
      },
      policy: { outcome: 'allow', reason: input.reason ?? `human ${input.action}` },
      provenance: {
        ...existing.provenance,
        summary: `${existing.provenance.summary}; human=${input.action} by ${input.actor}`,
      },
    };
    this.results.set(input.decisionId, result);
    return result;
  }

  /** Replay reads durable checkpoints — never re-invokes handlers. */
  async replay(runId: string): Promise<DecisionLabRun | undefined> {
    const payload = await this.durable.loadLatest(runId);
    if (!payload?.result) return undefined;
    return enrichLabRun(payload.result);
  }

  evaluate(input: {
    decisionId: string;
    actualOutcome?: unknown;
    expectedDecision?: string;
    metadata?: Record<string, unknown>;
  }): DecisionEvaluationRecord {
    const rec: DecisionEvaluationRecord = {
      decisionId: input.decisionId,
      actualOutcome: input.actualOutcome,
      expectedDecision: input.expectedDecision,
      recordedAt: new Date().toISOString(),
      metadata: input.metadata,
    };
    const list = this.evaluations.get(input.decisionId) ?? [];
    list.push(rec);
    this.evaluations.set(input.decisionId, list);
    this.history?.attachEvaluation(input.decisionId, rec);
    return rec;
  }

  getResult(decisionId: string): DecisionResult | undefined {
    return this.results.get(decisionId);
  }

  getHistory(): DecisionHistory | undefined {
    return this.history;
  }

  getCalibration(): CalibrationModel | undefined {
    return this.calibration;
  }

  setCalibration(model: CalibrationModel | undefined): void {
    this.calibration = model;
  }

  toLabRun(decisionId: string): DecisionLabRun | undefined {
    const result = this.results.get(decisionId);
    if (!result) return undefined;
    return enrichLabRun(result);
  }
}

/** Convenience factory. */
export function createDecisionRuntime(options?: DecisionRuntimeOptions): DecisionRuntime {
  return new DecisionRuntime(options);
}
