import { createHash, randomUUID } from 'crypto';
import {
  AutonomousConfigurationError,
  AutonomousDiagnosticCodes,
  type AutonomousDecision,
  type AutonomousDecisionEngine,
  type AutonomousObservation,
  type AutonomousRuntimePort,
  getRegisteredAutonomousServices,
} from '@hazeljs/core';
import logger from '@hazeljs/core';
import {
  AgentGatekeeper,
  GatekeeperApprovalRequiredError,
  GatekeeperDeniedError,
  InMemoryApprovalProvider,
  InMemoryAuditSink,
  fromFunction,
  argumentDigest,
  type ProtectedTool,
  type ToolInvocationContext,
} from '@hazeljs/agent-gatekeeper';
import { CapabilityRegistry, effectToGateClassification } from '../capability/registry';
import { policiesFromCapabilities } from '../capability/policies';
import { RulesDecisionEngine } from '../decision/rules-engine';
import { buildObservation, redactPayload } from '../observation/envelope';
import { LoopProtector, mergeLoopProtection } from '../observation/loop-protection';
import { AutonomousMetrics } from '../observability/metrics';
import { MemoryAutonomousRunStore, newRunId } from '../store/memory-run.store';
import type {
  AarPhase,
  AarRunMetadata,
  AarTimelineEvent,
  AutonomousModuleOptions,
  AutonomousRunRecord,
  AutonomousRunStore,
  RegisteredCapability,
} from '../types';

export class AutonomousRuntime implements AutonomousRuntimePort {
  readonly registry = new CapabilityRegistry();
  private readonly store: AutonomousRunStore;
  private readonly decisionEngine: AutonomousDecisionEngine;
  private gatekeeper: AgentGatekeeper;
  private readonly loop = new LoopProtector();
  private readonly metrics: AutonomousMetrics;
  private readonly globalLoop;
  private readonly simulation: boolean;
  private readonly resolveTenantId?: (o: AutonomousObservation) => string | undefined;
  private started = false;
  private readonly instances = new Map<new (...args: unknown[]) => unknown, object>();
  private readonly pendingApprovals = new Map<
    string,
    { runId: string; capabilityId: string; argumentsHash: string; gatekeeperApprovalId?: string }
  >();

  constructor(private readonly options: AutonomousModuleOptions = {}) {
    this.store = options.storage ?? new MemoryAutonomousRunStore();
    this.decisionEngine = options.decisionEngine ?? new RulesDecisionEngine();
    this.gatekeeper =
      options.gatekeeper ??
      new AgentGatekeeper({
        mode: 'enforce',
        defaultDecision: 'deny',
        approvalProvider: new InMemoryApprovalProvider(),
        auditSink: new InMemoryAuditSink(),
      });
    this.metrics = new AutonomousMetrics(options.observability?.enabled !== false);
    this.globalLoop = mergeLoopProtection(options.loopProtection);
    this.simulation = options.simulation === true;
    this.resolveTenantId = options.resolveTenantId;
  }

  bindInstance(Cls: new (...args: unknown[]) => unknown, instance: object): void {
    this.instances.set(Cls, instance);
  }

  async start(): Promise<void> {
    if (this.started) return;

    const classes = new Set<new (...args: unknown[]) => unknown>();
    if (this.options.autoDiscover !== false) {
      for (const c of getRegisteredAutonomousServices()) {
        classes.add(c);
      }
    }
    for (const c of this.options.services ?? []) {
      classes.add(c);
    }

    for (const Cls of classes) {
      const instance = this.instances.get(Cls) ?? tryConstruct(Cls);
      if (!instance) {
        logger.warn(`Autonomous: skip ${Cls.name} — no instance (provide via bindInstance / DI)`);
        continue;
      }
      this.registry.registerServiceInstance(Cls, instance);
      logger.info(`Autonomous: registered ${Cls.name}`);
    }

    this.syncGatekeeperPolicies();
    this.started = true;
  }

  registerInstance(Cls: new (...args: unknown[]) => unknown, instance: object): void {
    this.bindInstance(Cls, instance);
    this.registry.registerServiceInstance(Cls, instance);
    this.syncGatekeeperPolicies();
  }

  private syncGatekeeperPolicies(): void {
    const generated = policiesFromCapabilities(this.registry.listCapabilities());
    // Replace mutable policy list while preserving external policies if any were passed
    const external = (this.options.gatekeeper?.policies ?? []).filter(
      (p) => !p.id.startsWith('aar.capability.')
    );
    (this.gatekeeper.policies as typeof generated).splice(
      0,
      this.gatekeeper.policies.length,
      ...external,
      ...generated
    );
  }

  async emit(
    eventType: string,
    payload: unknown,
    opts: {
      source?: string;
      subject?: string;
      correlationId?: string;
      causationId?: string;
      tenantId?: string;
      depth?: number;
      schemaVersion?: number;
    } = {}
  ): Promise<string[]> {
    await this.ensureStarted();
    const observation = buildObservation({
      eventType,
      payload,
      source: opts.source,
      subject: opts.subject,
      correlationId: opts.correlationId,
      causationId: opts.causationId,
      tenantId: opts.tenantId,
      depth: opts.depth,
      schemaVersion: opts.schemaVersion,
    });
    if (this.resolveTenantId) {
      observation.tenantId = this.resolveTenantId(observation) ?? observation.tenantId;
    } else if (opts.tenantId) {
      observation.tenantId = opts.tenantId;
    }
    const runId = await this.ingest(observation);
    return runId ? [runId] : [];
  }

  async ingest(observation: AutonomousObservation): Promise<string | undefined> {
    await this.ensureStarted();
    const observers = this.registry.observersFor(observation.eventType);
    if (observers.length === 0) {
      logger.debug(`Autonomous: no observers for ${observation.eventType}`);
      return undefined;
    }

    let lastRunId: string | undefined;
    for (const obs of observers) {
      const service = this.registry.getService(obs.serviceId);
      if (!service || service.mode === 'disabled') continue;

      const protection = mergeLoopProtection(this.globalLoop, service.loopProtection);
      this.loop.assertAllowed(observation, protection, 0);

      const handler = (service.instance as Record<string, (...args: unknown[]) => unknown>)[
        obs.propertyKey
      ];
      let handlerResult: unknown = observation.payload;
      if (typeof handler === 'function') {
        handlerResult = await handler.call(service.instance, observation.payload, observation);
      }

      const enriched: AutonomousObservation = {
        ...observation,
        payload: handlerResult ?? observation.payload,
      };

      if (obs.recordOnly || service.mode === 'observe-only') {
        lastRunId = await this.recordObserveOnly(service.id, service.mode, enriched);
        continue;
      }

      lastRunId = await this.runPipeline(service.id, enriched);
    }
    return lastRunId;
  }

  async resume(runId: string, approval: { approved: boolean; actor: string }): Promise<void> {
    const run = await this.store.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (run.metadata.phase !== 'approval_pending') {
      throw new Error(`Run ${runId} is not awaiting approval (phase=${run.metadata.phase})`);
    }

    const decision = run.metadata.decision;
    if (!decision || (decision.type !== 'request-approval' && decision.type !== 'execute')) {
      throw new Error(`Run ${runId} has no executable decision`);
    }

    const approvalId = run.metadata.approvalId;
    const pending = approvalId ? this.pendingApprovals.get(approvalId) : undefined;

    if (!approval.approved) {
      if (pending?.gatekeeperApprovalId) {
        await this.gatekeeper.approvalProvider.resolve(
          pending.gatekeeperApprovalId,
          'rejected',
          approval.actor
        );
      }
      await this.finish(run, 'cancelled', 'cancelled', {
        reason: `Rejected by ${approval.actor}`,
      });
      if (approvalId) this.pendingApprovals.delete(approvalId);
      this.metrics.setApprovalsPending(this.pendingApprovals.size);
      return;
    }

    const capabilityId = decision.capabilityId;
    const args = decision.arguments;
    const hash = hashArgs(args);
    if (pending && pending.argumentsHash !== hash) {
      throw new AutonomousConfigurationError({
        code: AutonomousDiagnosticCodes.CAPABILITY_INVALID,
        message: 'Approval argument digest mismatch — approval invalidated.',
        suggestion: 'Request a new approval for the current arguments.',
      });
    }

    let gatekeeperToken: string | undefined;
    if (pending?.gatekeeperApprovalId) {
      await this.gatekeeper.approvalProvider.resolve(
        pending.gatekeeperApprovalId,
        'approved',
        approval.actor
      );
      gatekeeperToken = pending.gatekeeperApprovalId;
    }

    if (approvalId) this.pendingApprovals.delete(approvalId);
    this.metrics.setApprovalsPending(this.pendingApprovals.size);

    await this.executeCapability(run, capabilityId, args, gatekeeperToken);
  }

  async listRuns(filter?: { serviceId?: string; status?: string }): Promise<AutonomousRunRecord[]> {
    return this.store.list(filter);
  }

  async inspect(runId: string): Promise<AutonomousRunRecord | undefined> {
    return this.store.get(runId);
  }

  async timeline(runId: string): Promise<AarTimelineEvent[]> {
    const run = await this.store.get(runId);
    return run?.metadata.timeline ?? [];
  }

  async replay(runId: string, opts: { dryRun?: boolean } = {}): Promise<AutonomousRunRecord> {
    const dryRun = opts.dryRun !== false;
    const original = await this.store.get(runId);
    if (!original) throw new Error(`Run not found: ${runId}`);
    if (!dryRun) {
      throw new Error('Live replay is disabled; use dry-run to avoid repeating side effects.');
    }
    const cloneId = newRunId();
    const meta: AarRunMetadata = {
      ...original.metadata,
      phase: 'completed',
      dryRun: true,
      timeline: [
        ...(original.metadata.timeline ?? []),
        {
          at: new Date().toISOString(),
          type: 'replay.recorded',
          detail: `Dry-run replay of ${runId}`,
        },
      ],
    };
    await this.store.create({
      id: cloneId,
      serviceId: original.serviceId,
      input: original.input,
      tenantId: original.tenantId,
      metadata: meta,
    });
    return this.store.update(cloneId, {
      status: 'completed',
      metadata: meta,
      output: original.output,
    });
  }

  async diff(runA: string, runB: string): Promise<Record<string, unknown>> {
    const a = await this.store.get(runA);
    const b = await this.store.get(runB);
    if (!a || !b) throw new Error('Both runs required for diff');
    return {
      runA,
      runB,
      phase: { a: a.metadata.phase, b: b.metadata.phase },
      decision: { a: a.metadata.decision, b: b.metadata.decision },
      capabilityId: { a: a.metadata.capabilityId, b: b.metadata.capabilityId },
      status: { a: a.status, b: b.status },
      effectStatus: { a: a.metadata.effectStatus, b: b.metadata.effectStatus },
    };
  }

  async recover(): Promise<string[]> {
    const all = await this.store.list();
    const recovered: string[] = [];
    for (const run of all) {
      if (run.metadata.phase === 'executing') {
        await this.appendTimeline(run, 'recovery.reconcile', 'Interrupted during execution');
        await this.store.update(run.id, {
          status: 'suspended',
          error: { message: 'Interrupted during execution', code: 'AAR_INTERRUPTED' },
          metadata: { ...run.metadata, phase: 'reconcile', effectStatus: 'uncertain' },
        });
        this.metrics.incRecoveries();
        recovered.push(run.id);
      }
    }
    return recovered;
  }

  getMetrics(): ReturnType<AutonomousMetrics['getSnapshot']> {
    return this.metrics.getSnapshot();
  }

  getGatekeeper(): AgentGatekeeper {
    return this.gatekeeper;
  }

  private async runPipeline(
    serviceId: string,
    observation: AutonomousObservation
  ): Promise<string> {
    const service = this.registry.getService(serviceId)!;
    const started = Date.now();
    const runId = newRunId();
    let meta: AarRunMetadata = {
      kind: 'autonomous',
      serviceId,
      phase: 'created',
      mode: service.mode,
      observation: {
        ...observation,
        payload: redactPayload(observation.payload),
      },
      timeline: [],
      dryRun: this.simulation,
    };

    let run = await this.store.create({
      id: runId,
      serviceId,
      input: observation,
      tenantId: observation.tenantId,
      metadata: meta,
    });
    this.metrics.incRuns();

    run = await this.transition(run, 'observing', 'running');
    await this.appendTimeline(run, 'observation.received', observation.eventType);

    run = await this.transition(run, 'evaluating', 'running');
    await this.appendTimeline(run, 'decision.started');

    const decision = await this.decisionEngine.evaluate({
      observation,
      serviceId,
      objective: service.objective,
      mode: service.mode,
      allowedCapabilities: service.capabilities,
      policies: service.policies,
    });
    this.metrics.incDecisions();

    meta = {
      ...(await this.store.get(runId))!.metadata,
      decision,
      phase: 'decision_recorded',
    };
    run = await this.store.update(runId, { metadata: meta, status: 'running' });
    await this.appendTimeline(run, 'decision.recorded', decision.type);

    if (decision.type === 'no-action' || decision.type === 'recommend') {
      await this.finish(run, 'completed', 'completed', { decision });
      this.metrics.recordDuration(Date.now() - started);
      return runId;
    }

    const capabilityId = decision.capabilityId;
    const cap = this.registry.getCapability(capabilityId);
    if (!cap || !cap.granted) {
      this.metrics.incDenied();
      await this.finish(run, 'failed', 'failed', {
        error: {
          message: `Capability ${capabilityId} not granted`,
          code: AutonomousDiagnosticCodes.GRANT_MISSING,
        },
      });
      return runId;
    }

    const needsApproval =
      decision.type === 'request-approval' ||
      cap.approval === 'required' ||
      service.mode === 'approval-required';

    if (needsApproval) {
      await this.enterApproval(run, capabilityId, decision.arguments, decision.reason);
      this.metrics.recordDuration(Date.now() - started);
      return runId;
    }

    await this.executeCapability(run, capabilityId, decision.arguments, undefined);
    this.metrics.recordDuration(Date.now() - started);
    return runId;
  }

  private async enterApproval(
    run: AutonomousRunRecord,
    capabilityId: string,
    args: unknown,
    reason: string
  ): Promise<void> {
    const aarApprovalId = `apr_${randomUUID()}`;
    const argumentsHash = hashArgs(args);
    let gatekeeperApprovalId: string | undefined;

    const cap = this.registry.getCapability(capabilityId);
    // Probe Gatekeeper only for capabilities that require its approval — never execute here.
    if (cap && cap.approval === 'required') {
      try {
        await this.gatekeeper.execute({
          context: this.buildContext(run, capabilityId, args),
          tool: this.toProtectedTool(cap),
        });
      } catch (err) {
        if (err instanceof GatekeeperApprovalRequiredError) {
          gatekeeperApprovalId = err.approvalRequestId;
        } else if (err instanceof GatekeeperDeniedError) {
          // Continue parking; resume will revalidate.
        }
      }
    }

    this.pendingApprovals.set(aarApprovalId, {
      runId: run.id,
      capabilityId,
      argumentsHash,
      gatekeeperApprovalId,
    });

    const meta: AarRunMetadata = {
      ...run.metadata,
      phase: 'approval_pending',
      capabilityId,
      approvalId: aarApprovalId,
      decision: {
        type: 'request-approval',
        capabilityId,
        arguments: args,
        reason,
      },
    };
    await this.store.update(run.id, { status: 'waiting_for_human', metadata: meta });
    await this.appendTimeline((await this.store.get(run.id))!, 'approval.pending', reason, {
      capabilityId,
      argumentsHash,
      gatekeeperApprovalId,
    });
    this.metrics.setApprovalsPending(this.pendingApprovals.size);
  }

  private async executeCapability(
    run: AutonomousRunRecord,
    capabilityId: string,
    args: unknown,
    approvalToken: string | undefined
  ): Promise<void> {
    const cap = this.registry.getCapability(capabilityId);
    if (!cap || !cap.granted) {
      this.metrics.incDenied();
      await this.finish(run, 'failed', 'failed', {
        error: {
          message: `Capability ${capabilityId} not granted`,
          code: AutonomousDiagnosticCodes.GRANT_MISSING,
        },
      });
      return;
    }

    if (this.simulation || run.metadata.dryRun) {
      await this.appendTimeline(run, 'capability.simulated', capabilityId);
      await this.finish(run, 'completed', 'completed', {
        output: { simulated: true, capabilityId, arguments: args },
        effectStatus: 'succeeded',
      });
      return;
    }

    let current = await this.transition(run, 'ready_to_execute', 'running');
    current = await this.transition(current, 'executing', 'running');
    await this.appendTimeline(current, 'capability.execution.started', capabilityId);

    current = await this.store.update(current.id, {
      metadata: {
        ...current.metadata,
        phase: 'executing',
        capabilityId,
        effectStatus: 'uncertain',
      },
    });

    const tool = this.toProtectedTool(cap);
    try {
      const result = await this.gatekeeper.execute({
        context: this.buildContext(current, capabilityId, args, approvalToken),
        tool,
      });

      await this.appendTimeline(current, 'capability.execution.completed', capabilityId);
      this.metrics.incExecuted();
      await this.finish(current, 'completed', 'completed', {
        output: result.output,
        effectStatus: 'succeeded',
      });
    } catch (err) {
      if (err instanceof GatekeeperApprovalRequiredError) {
        await this.enterApproval(
          current,
          capabilityId,
          args,
          'Gatekeeper required approval before execution'
        );
        return;
      }
      if (err instanceof GatekeeperDeniedError) {
        this.metrics.incDenied();
        await this.appendTimeline(current, 'capability.denied', String(err.message));
        await this.finish(current, 'failed', 'failed', {
          error: { message: err.message, code: 'GATEKEEPER_DENIED' },
          effectStatus: 'failed',
        });
        return;
      }
      await this.appendTimeline(current, 'capability.failed', String(err));
      await this.finish(current, 'failed', 'failed', {
        error: { message: err instanceof Error ? err.message : String(err) },
        effectStatus: 'uncertain',
      });
    }
  }

  private buildContext(
    run: AutonomousRunRecord,
    capabilityId: string,
    args: unknown,
    approvalToken?: string
  ): ToolInvocationContext {
    return {
      invocationId: `inv_${randomUUID()}`,
      runId: run.id,
      agentId: run.serviceId,
      tenantId: run.tenantId,
      sessionId: run.id,
      toolName: capabilityId,
      input: (args ?? {}) as Record<string, unknown>,
      environment: 'local',
      timestamp: new Date(),
      capabilities: this.registry.getService(run.serviceId)?.capabilities ?? [],
      approvalToken,
    };
  }

  private toProtectedTool(cap: RegisteredCapability): ProtectedTool {
    return fromFunction(cap.id, async (input: unknown): Promise<unknown> => cap.method(input), {
      classification: effectToGateClassification(cap.effect),
      riskLevel: cap.effect === 'irreversible' ? 'high' : 'medium',
      version: cap.version,
      description: `Autonomous capability ${cap.id}`,
    });
  }

  private async recordObserveOnly(
    serviceId: string,
    mode: AarRunMetadata['mode'],
    observation: AutonomousObservation
  ): Promise<string> {
    const runId = newRunId();
    const meta: AarRunMetadata = {
      kind: 'autonomous',
      serviceId,
      phase: 'completed',
      mode,
      observation: { ...observation, payload: redactPayload(observation.payload) },
      decision: { type: 'no-action', reason: `Mode ${mode}` },
      timeline: [
        {
          at: new Date().toISOString(),
          type: 'observation.received',
          detail: observation.eventType,
        },
        {
          at: new Date().toISOString(),
          type: 'run.completed',
          detail: 'observe-only',
        },
      ],
    };
    await this.store.create({
      id: runId,
      serviceId,
      input: observation,
      tenantId: observation.tenantId,
      metadata: meta,
    });
    await this.store.update(runId, { status: 'completed', metadata: meta });
    this.metrics.incRuns();
    return runId;
  }

  private async transition(
    run: AutonomousRunRecord,
    phase: AarPhase,
    status: string
  ): Promise<AutonomousRunRecord> {
    const metadata = { ...run.metadata, phase };
    return this.store.update(run.id, { status, metadata });
  }

  private async finish(
    run: AutonomousRunRecord,
    phase: AarPhase,
    status: string,
    extra: {
      output?: unknown;
      error?: { message: string; code?: string };
      decision?: AutonomousDecision;
      reason?: string;
      effectStatus?: AarRunMetadata['effectStatus'];
    } = {}
  ): Promise<void> {
    const latest = (await this.store.get(run.id))!;
    const metadata: AarRunMetadata = {
      ...latest.metadata,
      phase,
      decision: extra.decision ?? latest.metadata.decision,
      effectStatus: extra.effectStatus ?? latest.metadata.effectStatus,
      timeline: [
        ...(latest.metadata.timeline ?? []),
        {
          at: new Date().toISOString(),
          type: status === 'completed' ? 'run.completed' : `run.${status}`,
          detail: extra.reason ?? extra.error?.message,
        },
      ],
    };
    await this.store.update(run.id, {
      status,
      output: extra.output,
      error: extra.error,
      metadata,
    });
  }

  private async appendTimeline(
    run: AutonomousRunRecord,
    type: string,
    detail?: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const latest = (await this.store.get(run.id))!;
    const event: AarTimelineEvent = {
      at: new Date().toISOString(),
      type,
      detail,
      data,
    };
    await this.store.update(run.id, {
      metadata: {
        ...latest.metadata,
        timeline: [...(latest.metadata.timeline ?? []), event],
      },
    });
  }

  private async ensureStarted(): Promise<void> {
    if (!this.started) await this.start();
  }
}

function tryConstruct(Cls: new (...args: unknown[]) => unknown): object | undefined {
  try {
    return new Cls() as object;
  } catch {
    return undefined;
  }
}

function hashArgs(args: unknown): string {
  try {
    return argumentDigest(args);
  } catch {
    return createHash('sha256')
      .update(JSON.stringify(args ?? null))
      .digest('hex');
  }
}

export { buildObservation };
