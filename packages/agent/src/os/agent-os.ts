/**
 * AgentOS — public control-plane facade over runtime + local platform + HITL.
 * Does not bypass AgentRuntime, Skillgate, Gatekeeper, or the durable kernel.
 */

import * as path from 'path';
import { parseDna, type AgentDna } from '../dna/agent-dna';
import { createAgentClassFromDna, type DnaToolHandler } from '../dna/bootstrap-from-dna';
import {
  createLocalPlatform,
  PLATFORM_API_VERSION,
  type AgentDefinition,
  type AgentDeployment,
  type LocalPlatform,
} from '../platform';
import { PolicyEngine } from '../policies/policy.engine';
import {
  createDurableRunStore,
  createDurableRunStoreFromEnv,
  durableRunStoreBackendFromEnv,
  type DurableRunStore,
} from '../run/durable-run-store';
import { AgentRunStatus, type AgentRun } from '../run/agent-run.types';
import type { HumanTask, HumanTaskService } from '../run/human-task.service';
import { InMemoryAgentScheduler } from '../scheduler/agent-scheduler';
import { FileTimelineStore } from '../timeline/timeline.store';
import type { LLMProvider } from '../types/llm.types';
import { AgentEventType, type AgentEvent } from '../types/event.types';
import { AgentRuntime, type AgentRuntimeConfig } from '../runtime/agent.runtime';
import type { AgentExecutionResult } from '../types/agent.types';
import type { ToolAuthorizationGate } from '../authorization/tool-authorization-gate.interface';
import { createMockLlmProvider } from '../llm/http-llm.provider';
import { autonomyPolicyRules } from './autonomy-policies';
import { defineAgent, type DefineAgentInput } from './define-agent';
import { occupancyFromBackend, projectOfficeStatus } from './status';
import { SloTracker } from './slo-tracker';
import { UsageLedger } from './usage-ledger';
import type {
  DesiredAgentPhase,
  OfficeAgent,
  OfficeAgentOccupancy,
  OfficeMetricsSnapshot,
  OfficeSkillSummary,
} from './types';

export interface AgentOSOptions {
  projectRoot?: string;
  storePath?: string;
  durableDir?: string;
  timelinePath?: string;
  eventsPath?: string;
  llmProvider?: LLMProvider;
  skillHandlers?: Record<string, DnaToolHandler>;
  workerId?: string;
  authorizationGate?: ToolAuthorizationGate;
  createAuthorizationGate?: (humanTasks: HumanTaskService) => ToolAuthorizationGate | undefined;
  namespace?: string;
  runtime?: Omit<
    AgentRuntimeConfig,
    'llmProvider' | 'runRepository' | 'checkpointService' | 'humanTaskService' | 'scheduler'
  >;
}

export class AgentOS {
  readonly platform: LocalPlatform;
  readonly runtime: AgentRuntime;
  readonly store: DurableRunStore;
  readonly slo: SloTracker;
  readonly usage: UsageLedger;
  readonly namespace: string;
  private readonly skillHandlers: Record<string, DnaToolHandler>;
  private readonly scheduler = new InMemoryAgentScheduler();
  private readonly sleepJobs = new Map<string, string>();

  constructor(options: AgentOSOptions = {}) {
    const projectRoot = options.projectRoot ?? process.cwd();
    this.namespace = options.namespace ?? 'default';
    this.skillHandlers = options.skillHandlers ?? {};
    const durableDir = path.resolve(options.durableDir ?? path.join(projectRoot, '.hazel', 'runs'));
    const storePath = path.resolve(
      options.storePath ?? path.join(projectRoot, '.hazel', 'platform', 'resources.json')
    );
    const timelinePath = options.timelinePath ?? path.join(durableDir, 'timeline.jsonl');

    this.platform = createLocalPlatform({
      storePath,
      projectRoot,
      durableDir,
      timelinePath,
      eventsPath: options.eventsPath,
      actor: 'agent-os',
    });

    this.store =
      durableRunStoreBackendFromEnv() === 'sql'
        ? createDurableRunStoreFromEnv({ cwd: projectRoot })
        : createDurableRunStore(durableDir);
    const authorizationGate =
      options.authorizationGate ?? options.createAuthorizationGate?.(this.store.humanTaskService);
    this.slo = new SloTracker((type, agentId, executionId, data) => {
      this.runtime.emit(type, agentId, executionId, data);
    });
    this.usage = new UsageLedger();

    this.runtime = new AgentRuntime({
      llmProvider: options.llmProvider ?? createMockLlmProvider(),
      durableSuspend: true,
      workerId: options.workerId ?? 'agent-os',
      enableRetry: false,
      enableCircuitBreaker: false,
      enableMetrics: true,
      runRepository: this.store.runRepository,
      checkpointService: this.store.checkpointService,
      humanTaskService: this.store.humanTaskService,
      timelineStore: new FileTimelineStore(timelinePath),
      scheduler: this.scheduler,
      authorizationGate,
      policyEngine: new PolicyEngine([]),
      ...options.runtime,
    });

    this.scheduler.setHandler(async (job) => {
      const occupancy = this.readOccupancy(job.agentName);
      if (occupancy.desiredPhase === 'paused' || occupancy.desiredPhase === 'terminated') {
        return;
      }
      await this.patchOccupancy(job.agentName, {
        desiredPhase: 'running',
        nextWakeAt: undefined,
        sleepJobId: undefined,
      });
      this.emitControl(AgentEventType.AGENT_WOKEN, job.agentName, job.runId ?? '', {
        reason: 'schedule',
      });
      await this.start(job.agentName, job.input);
    });

    this.runtime.onAny((raw) => {
      const event = raw as AgentEvent;
      if (event.type === AgentEventType.LOOP_ITERATION) {
        const data = event.data as { stage?: string; plan?: string };
        void this.patchOccupancy(event.agentId, {
          currentStage: data.stage,
          currentTask: data.plan?.slice(0, 180),
        });
      }
      if (event.type === AgentEventType.EXECUTION_COMPLETED) {
        const data = event.data as { duration?: number };
        this.slo.record({
          agentId: event.agentId,
          success: true,
          durationMs: data.duration ?? 0,
          at: new Date(),
        });
      }
      if (event.type === AgentEventType.EXECUTION_FAILED) {
        const data = event.data as { duration?: number };
        this.slo.record({
          agentId: event.agentId,
          success: false,
          durationMs: data.duration ?? 0,
          at: new Date(),
        });
      }
      if (event.type === AgentEventType.TOOL_EXECUTION_COMPLETED) {
        const data = event.data as { toolName?: string };
        this.usage.record({
          agentId: event.agentId,
          at: new Date(),
          skillName: data.toolName,
        });
      }
    });
  }

  async deploy(source: AgentDna | DefineAgentInput): Promise<OfficeAgent> {
    const dna = isDefineAgentInput(source) ? defineAgent(source) : parseDna(source);
    const name = dna.name;

    const definition: AgentDefinition = {
      apiVersion: PLATFORM_API_VERSION,
      kind: 'AgentDefinition',
      metadata: { name, namespace: this.namespace },
      spec: { dna },
    };
    const deployment: AgentDeployment = {
      apiVersion: PLATFORM_API_VERSION,
      kind: 'AgentDeployment',
      metadata: { name, namespace: this.namespace },
      spec: {
        definitionRef: { kind: 'AgentDefinition', name, namespace: this.namespace },
        runtimeClassName: 'local',
      },
    };

    await this.platform.reconciler.applyResource(definition);
    await this.platform.reconciler.applyResource(deployment);

    this.registerFromDna(dna);
    this.slo.setTarget(name, dna.slo);
    await this.patchOccupancy(name, { desiredPhase: 'running' });
    this.emitControl(AgentEventType.AGENT_DEPLOYED, name, '', { dna: dna.name });

    if (dna.schedule?.kind === 'daily' || dna.schedule?.kind === 'hourly') {
      const next = nextWakeDate(dna.schedule.kind, dna.schedule.cron);
      await this.sleepUntil(name, next);
    }

    return this.requireAgent(name);
  }

  async list(): Promise<OfficeAgent[]> {
    const deps = this.platform.repo.list({
      kind: 'AgentDeployment',
      namespace: this.namespace,
    }) as AgentDeployment[];
    const out: OfficeAgent[] = [];
    for (const dep of deps) {
      const view = await this.toOfficeAgent(dep);
      if (view) out.push(view);
    }
    return out;
  }

  async get(id: string): Promise<OfficeAgent | undefined> {
    const dep = this.platform.repo.get('AgentDeployment', id, this.namespace) as
      | AgentDeployment
      | undefined;
    if (!dep) return undefined;
    return this.toOfficeAgent(dep);
  }

  async pause(id: string): Promise<OfficeAgent> {
    const current = await this.requireAgent(id);
    if (current.currentRun && !isTerminal(current.currentRun.status)) {
      this.runtime.cancel(current.currentRun.id);
    }
    const jobId = this.sleepJobs.get(id);
    if (jobId) await this.scheduler.cancel(jobId);
    await this.patchOccupancy(id, { desiredPhase: 'paused' });
    this.emitControl(AgentEventType.AGENT_PAUSED, id, '', {});
    return this.requireAgent(id);
  }

  async resume(id: string): Promise<OfficeAgent> {
    await this.patchOccupancy(id, { desiredPhase: 'running', nextWakeAt: undefined });
    this.emitControl(AgentEventType.AGENT_RESUMED, id, '', {});
    return this.requireAgent(id);
  }

  async restart(id: string): Promise<OfficeAgent> {
    const agent = await this.requireAgent(id);
    if (agent.currentRun && !isTerminal(agent.currentRun.status)) {
      this.runtime.cancel(agent.currentRun.id);
    }
    await this.patchOccupancy(id, { desiredPhase: 'running' });
    await this.start(id, agent.dna.mission?.goal);
    return this.requireAgent(id);
  }

  async terminate(id: string): Promise<void> {
    const agent = await this.get(id);
    if (agent?.currentRun && !isTerminal(agent.currentRun.status)) {
      this.runtime.cancel(agent.currentRun.id);
    }
    const jobId = this.sleepJobs.get(id);
    if (jobId) await this.scheduler.cancel(jobId);
    await this.patchOccupancy(id, { desiredPhase: 'terminated' });
    this.runtime.unregisterAgent(id);
    this.platform.repo.delete('AgentDeployment', id, this.namespace);
    this.platform.repo.delete('AgentDefinition', id, this.namespace);
    this.emitControl(AgentEventType.AGENT_TERMINATED, id, '', {});
  }

  async start(id: string, input?: string): Promise<AgentRun | undefined> {
    const agent = await this.requireAgent(id);
    if (
      agent.occupancy.desiredPhase === 'paused' ||
      agent.occupancy.desiredPhase === 'terminated'
    ) {
      throw new Error(`Agent ${id} is ${agent.occupancy.desiredPhase}`);
    }
    await this.patchOccupancy(id, { desiredPhase: 'running', currentTask: input });
    const result = await this.runtime.execute(
      id,
      input ?? agent.dna.mission?.goal ?? 'Continue your mission',
      {
        maxSteps: 8,
        loop: {
          maxIterations: 3,
          successScore: 80,
          stages: ['observe', 'plan', 'execute', 'critique', 'validate'],
        },
        enableMemory: agent.dna.memory?.enabled !== false,
      }
    );
    return this.runtime.getRun(result.executionId);
  }

  async sleepUntil(id: string, at: Date): Promise<OfficeAgent> {
    const existing = this.sleepJobs.get(id);
    if (existing) await this.scheduler.cancel(existing);
    const jobId = await this.scheduler.scheduleAt(at, {
      agentName: id,
      input: (await this.requireAgent(id)).dna.mission?.goal ?? 'Wake',
    });
    this.sleepJobs.set(id, jobId);
    await this.patchOccupancy(id, {
      desiredPhase: 'sleeping',
      nextWakeAt: at.toISOString(),
      sleepJobId: jobId,
    });
    this.emitControl(AgentEventType.AGENT_SLEEPING, id, '', { nextWakeAt: at.toISOString() });
    return this.requireAgent(id);
  }

  async wake(id: string): Promise<OfficeAgent> {
    const jobId = this.sleepJobs.get(id);
    if (jobId) await this.scheduler.cancel(jobId);
    this.sleepJobs.delete(id);
    await this.patchOccupancy(id, {
      desiredPhase: 'running',
      nextWakeAt: undefined,
      sleepJobId: undefined,
    });
    this.emitControl(AgentEventType.AGENT_WOKEN, id, '', { reason: 'manual' });
    await this.start(id);
    return this.requireAgent(id);
  }

  async recover(): Promise<{ reclaimed: number; rearmed: number }> {
    const leases = this.runtime.getRunLeaseService();
    const reclaimed = leases ? (await leases.reclaimExpired()).length : 0;
    let rearmed = 0;
    for (const agent of await this.list()) {
      this.registerFromDna(agent.dna);
      if (agent.occupancy.desiredPhase === 'sleeping' && agent.occupancy.nextWakeAt) {
        const when = new Date(agent.occupancy.nextWakeAt);
        if (when.getTime() <= Date.now()) {
          await this.wake(agent.id);
        } else {
          await this.sleepUntil(agent.id, when);
        }
        rearmed += 1;
      }
    }
    return { reclaimed, rearmed };
  }

  async listApprovals(): Promise<HumanTask[]> {
    const svc = this.runtime.getHumanTaskService();
    if (svc.listPending) return svc.listPending();
    const runs = await this.store.runRepository.list();
    const out: HumanTask[] = [];
    for (const run of runs) {
      const tasks = await svc.listByRun(run.id);
      out.push(...tasks.filter((t) => t.status === 'pending'));
    }
    return out;
  }

  async approve(taskId: string, approvedBy = 'office'): Promise<AgentExecutionResult> {
    return this.runtime.approveAndResume(taskId, { approved: true, approvedBy });
  }

  async reject(taskId: string, approvedBy = 'office'): Promise<AgentExecutionResult> {
    return this.runtime.approveAndResume(taskId, { approved: false, approvedBy });
  }

  async listRuns(agentId?: string): Promise<AgentRun[]> {
    return this.store.runRepository.list(agentId ? { agentName: agentId } : undefined);
  }

  listSkills(): OfficeSkillSummary[] {
    const byName = new Map<string, OfficeSkillSummary>();
    for (const name of this.runtime.getAgents()) {
      const meta = this.runtime.getAgentMetadata(name);
      const tools = this.runtime.getAgentTools(name);
      for (const tool of tools) {
        const existing = byName.get(tool.name) ?? {
          name: tool.name,
          description: tool.description,
          requiresApproval: tool.requiresApproval,
          agents: [],
        };
        if (!existing.agents.includes(name)) existing.agents.push(name);
        byName.set(tool.name, existing);
      }
      void meta;
    }
    return Array.from(byName.values());
  }

  async metrics(): Promise<OfficeMetricsSnapshot> {
    const agents = await this.list();
    const usage = this.usage.snapshot(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const runs = await this.listRuns();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = runs.filter((r) => r.createdAt.getTime() >= dayAgo);
    const done = recent.filter(
      (r) => r.status === AgentRunStatus.COMPLETED || r.status === AgentRunStatus.FAILED
    );
    const ok = recent.filter((r) => r.status === AgentRunStatus.COMPLETED).length;
    return {
      agents: agents.length,
      working: agents.filter((a) => a.status === 'working').length,
      waiting: agents.filter((a) => a.status === 'waiting').length,
      approvalRequired: agents.filter((a) => a.status === 'approval_required').length,
      sleeping: agents.filter((a) => a.status === 'sleeping').length,
      failed: agents.filter((a) => a.status === 'failed').length,
      runs24h: recent.length,
      successRate: done.length ? ok / done.length : 1,
      skillCalls: usage.skillCalls,
      tokens: usage.tokens,
      estimatedCostUsd: usage.estimatedCostUsd,
    };
  }

  events = {
    subscribe: (handler: (event: unknown) => void): (() => void) => {
      this.runtime.onAny(handler);
      return () => this.runtime.offAny(handler);
    },
  };

  async dispose(): Promise<void> {
    for (const jobId of this.sleepJobs.values()) {
      await this.scheduler.cancel(jobId);
    }
    this.sleepJobs.clear();
  }

  private registerFromDna(dna: AgentDna): void {
    if (!this.runtime.getAgentMetadata(dna.name)) {
      const Klass = createAgentClassFromDna(dna);
      this.runtime.registerAgent(Klass);
      this.runtime.registerAgentInstance(dna.name, new Klass());
    }
    for (const tool of dna.tools ?? []) {
      this.runtime.registerDynamicTool(dna.name, {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        requiresApproval: tool.requiresApproval,
        handler: this.skillHandlers[tool.name],
      });
    }
    const engine = this.runtime.getPolicyEngine() ?? new PolicyEngine([]);
    const extra = autonomyPolicyRules(
      dna.autonomy,
      (dna.tools ?? []).map((t) => t.name)
    );
    for (const raw of dna.policies ?? []) {
      if (raw && typeof raw === 'object' && 'effect' in raw && 'tool' in raw && 'id' in raw) {
        extra.push(raw as import('../policies/policy.engine').PolicyRule);
      }
    }
    const kept = engine
      .getRules()
      .filter((r) => !r.id.startsWith(`autonomy-`) && !r.id.startsWith(`dna-${dna.name}-`));
    const merged = [...kept];
    for (const rule of extra) {
      if (!merged.some((r) => r.id === rule.id)) merged.push(rule);
    }
    engine.setRules(merged);
    this.runtime.setPolicyEngine(engine);
  }

  private readOccupancy(name: string): OfficeAgentOccupancy {
    const dep = this.platform.repo.get('AgentDeployment', name, this.namespace) as
      | AgentDeployment
      | undefined;
    return occupancyFromBackend(dep?.status?.backend);
  }

  private async patchOccupancy(
    name: string,
    patch: Partial<OfficeAgentOccupancy> & { desiredPhase?: DesiredAgentPhase }
  ): Promise<void> {
    const dep = this.platform.repo.get('AgentDeployment', name, this.namespace) as
      | AgentDeployment
      | undefined;
    if (!dep) return;
    const backend = { ...(dep.status?.backend ?? {}), ...patch };
    this.platform.repo.updateStatus(
      'AgentDeployment',
      name,
      {
        ...dep.status,
        phase: patch.desiredPhase ?? (backend.desiredPhase as string | undefined),
        backend,
      },
      this.namespace
    );
  }

  private async toOfficeAgent(dep: AgentDeployment): Promise<OfficeAgent | undefined> {
    const def = this.platform.repo.get(
      'AgentDefinition',
      dep.spec.definitionRef.name,
      dep.spec.definitionRef.namespace ?? this.namespace
    ) as AgentDefinition | undefined;
    const dna = def?.spec.dna;
    if (!dna) return undefined;
    const occupancy = occupancyFromBackend(dep.status?.backend);
    const runs = await this.store.runRepository.list({ agentName: dna.name });
    const currentRun = pickCurrentRun(runs);
    const pending = (await this.listApprovals()).filter((t) => {
      const run = runs.find((r) => r.id === t.runId);
      return Boolean(run);
    }).length;
    const status = projectOfficeStatus({ occupancy, currentRun, pendingApprovals: pending });
    return {
      id: dep.metadata.name,
      name: dna.identity?.name ?? dna.name,
      description: dna.description ?? dna.identity?.description ?? dna.mission?.goal,
      status,
      dna,
      namespace: dep.metadata.namespace ?? this.namespace,
      occupancy,
      currentRun,
      createdAt: dep.metadata.creationTimestamp ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async requireAgent(id: string): Promise<OfficeAgent> {
    const agent = await this.get(id);
    if (!agent) throw new Error(`Agent not found: ${id}`);
    return agent;
  }

  private emitControl(
    type: AgentEventType,
    agentId: string,
    executionId: string,
    data: unknown
  ): void {
    this.runtime.emit(type, agentId, executionId, data);
  }
}

function isDefineAgentInput(v: AgentDna | DefineAgentInput): v is DefineAgentInput {
  return (
    typeof v === 'object' &&
    v !== null &&
    'mission' in v &&
    typeof (v as DefineAgentInput).mission === 'string'
  );
}

function isTerminal(status: AgentRunStatus): boolean {
  return (
    status === AgentRunStatus.COMPLETED ||
    status === AgentRunStatus.FAILED ||
    status === AgentRunStatus.CANCELLED ||
    status === AgentRunStatus.TIMED_OUT
  );
}

function pickCurrentRun(runs: AgentRun[]): AgentRun | undefined {
  const active = runs.find((r) => !isTerminal(r.status));
  if (active) return active;
  return [...runs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

export function nextWakeDate(kind: 'daily' | 'hourly', cron?: string, now = new Date()): Date {
  if (kind === 'hourly') {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
  const match = cron?.match(/^(\d{1,2}):(\d{2})$/);
  const hours = match ? Number(match[1]) : 9;
  const minutes = match ? Number(match[2]) : 0;
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}
