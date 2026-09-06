/**
 * OrganismRuntime — mission-defined self-organizing agent society control plane.
 * Composes AgentRuntime; does not replace the Agent OS kernel.
 */

import {
  AgentRuntime,
  PolicyEngine,
  createMockLlmProvider,
  type LLMProvider,
} from '@hazeljs/agent';
import type {
  AgentGeneDefinition,
  AgentGenealogy,
  AgentMutation,
  AgentOutcomeReport,
  ConstitutionDefinition,
  EnvironmentDefinition,
  EnvironmentSignal,
  GenerationEvaluationResult,
  MarketClearingResult,
  MarketConfig,
  MissionDefinition,
  NegotiationOffer,
  NegotiationResult,
  OrganismCycleConfig,
  OrganismDecision,
  OrganismGraph,
  OrganismInspectState,
  OrganismLimits,
  OrganismRecord,
  ReproduceRequest,
  ResourceBid,
  ResourceDefinition,
  ResourceRequest,
  RuntimeAgentRecord,
  SignalNeedMapping,
  SurvivalConfig,
  UtilityForecast,
  UtilityWeights,
} from '../types/organism.types';
import {
  DEFAULT_ORGANISM_LIMITS,
  DEFAULT_SURVIVAL_CONFIG,
  DEFAULT_UTILITY_WEIGHTS,
} from '../types/organism.types';
import { OrganismStateError } from '../errors/organism.errors';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';
import {
  InMemoryOrganismRepository,
  type OrganismRepository,
} from '../persistence/organism-repository';
import {
  resolveConstitution,
  resolveEnvironment,
  resolveGene,
  resolveMission,
  resolveResource,
  type OrganismDecoratorOptions,
} from '../decorators';
import { ConstitutionEnforcer } from '../governance/constitution';
import { ResourceAllocator } from '../economy/resource-allocator';
import { UtilityEngine, ReputationEngine } from '../economy/utility-engine';
import { UtilityForecaster } from '../economy/utility-forecaster';
import { MarketEngine } from '../economy/market-engine';
import { CapabilityRegistry } from './capability-registry';
import { NeedDetector, PerceptionEngine } from '../perception/perception-engine';
import { DecisionEngine } from '../lifecycle/decision-engine';
import { BirthEngine, TerminationEngine } from '../lifecycle/birth-engine';
import { SurvivalEngine } from '../lifecycle/survival-engine';
import {
  ReproductionEngine,
  DEFAULT_REPRODUCTION_CONFIG,
  type ReproductionConfig,
} from '../lifecycle/reproduction-engine';
import { GenealogyManager } from '../genealogy/genealogy-manager';
import { MutationEngine } from '../evolution/mutation-engine';
import { EvolutionEngine, GenerationManager } from '../evolution/evolution-engine';
import { applyMissionMetricUpdates, createMissionProgress } from './mission';
import { OrganismAgentContext } from './organism-context';
import { OrganismClock, parseDurationMs } from './clock';
import { OrganismMetrics } from '../observability/metrics';

type Newable = new (...args: unknown[]) => unknown;

export interface CreateOrganismOptions {
  id?: string;
  mission: MissionDefinition | Newable;
  genes?: Array<AgentGeneDefinition | Newable>;
  environment?: EnvironmentDefinition | Newable;
  constitution?: ConstitutionDefinition | Newable;
  resources?: ResourceDefinition | Newable;
  limits?: Partial<OrganismLimits>;
  cycles?: OrganismCycleConfig;
  signalNeedMappings?: SignalNeedMapping[];
  survival?: Partial<SurvivalConfig>;
  utilityWeights?: Partial<UtilityWeights>;
  reproduction?: Partial<ReproductionConfig>;
  market?: Partial<MarketConfig>;
  repository?: OrganismRepository;
  agentRuntime?: AgentRuntime;
  llmProvider?: LLMProvider;
  debug?: boolean;
  simulation?: boolean;
  /** Relevance threshold for perception (0-1). */
  relevanceThreshold?: number;
}

export interface SimulateOptions {
  duration: string | number;
  environment?: { clock?: 'accelerated' | 'real' };
  signals?: Array<Partial<EnvironmentSignal> & Pick<EnvironmentSignal, 'type' | 'source'>>;
  stepMs?: number;
  onEvent?: (line: string) => void;
}

export class OrganismRuntime {
  readonly id: string;
  readonly events: OrganismEventEmitter;
  readonly metrics = new OrganismMetrics();
  readonly capabilities = new CapabilityRegistry();
  readonly clock = new OrganismClock();

  private record!: OrganismRecord;
  private readonly repo: OrganismRepository;
  private readonly perception: PerceptionEngine;
  private readonly needDetector: NeedDetector;
  private readonly decisionEngine: DecisionEngine;
  private readonly allocator: ResourceAllocator;
  private readonly utilityEngine: UtilityEngine;
  private readonly reputationEngine: ReputationEngine;
  private readonly survivalEngine: SurvivalEngine;
  private readonly forecaster: UtilityForecaster;
  private marketEngine!: MarketEngine;
  private birthEngine!: BirthEngine;
  private terminationEngine!: TerminationEngine;
  private reproductionEngine!: ReproductionEngine;
  private genealogyManager!: GenealogyManager;
  private mutationEngine!: MutationEngine;
  private evolutionEngine!: EvolutionEngine;
  private generationManager!: GenerationManager;
  private constitutionEnforcer!: ConstitutionEnforcer;
  private agentRuntime: AgentRuntime;
  private cycleTimers: Array<ReturnType<typeof setInterval>> = [];
  private pendingApprovals = new Map<string, boolean>();
  private agentCache = new Map<string, RuntimeAgentRecord>();
  private reproductionConfig: ReproductionConfig = DEFAULT_REPRODUCTION_CONFIG;
  private debug: boolean;
  private log: (line: string) => void;

  private constructor(options: CreateOrganismOptions) {
    this.id = options.id ?? `org_${Date.now().toString(36)}`;
    this.events = new OrganismEventEmitter();
    this.repo = options.repository ?? new InMemoryOrganismRepository();
    this.debug = options.debug ?? false;
    this.log = (line: string): void => {
      if (this.debug || options.simulation) {
        // eslint-disable-next-line no-console
        console.log(line);
      }
    };

    this.perception = new PerceptionEngine(options.relevanceThreshold ?? 0.3);
    this.needDetector = new NeedDetector(options.signalNeedMappings ?? []);
    this.decisionEngine = new DecisionEngine(this.capabilities);
    this.allocator = new ResourceAllocator(this.events, this.id, () => this.clock.now());
    this.forecaster = new UtilityForecaster(this.events, this.id);
    this.utilityEngine = new UtilityEngine(this.events, this.id, {
      ...DEFAULT_UTILITY_WEIGHTS,
      ...options.utilityWeights,
    });
    this.reputationEngine = new ReputationEngine(this.events, this.id);
    this.survivalEngine = new SurvivalEngine(
      { ...DEFAULT_SURVIVAL_CONFIG, ...options.survival },
      () => this.clock.now()
    );
    this.reproductionConfig = {
      ...DEFAULT_REPRODUCTION_CONFIG,
      ...options.reproduction,
    };
    this.marketEngine = new MarketEngine(
      this.events,
      this.allocator,
      this.forecaster,
      this.id,
      () => this.clock.now(),
      options.market
    );

    this.agentRuntime =
      options.agentRuntime ??
      new AgentRuntime({
        llmProvider: options.llmProvider ?? createMockLlmProvider(),
        enableMetrics: true,
        enableRetry: false,
        enableCircuitBreaker: false,
      });
  }

  static async create(options: CreateOrganismOptions): Promise<OrganismRuntime> {
    const runtime = new OrganismRuntime(options);
    await runtime.initialize(options);
    return runtime;
  }

  /** Resolve decorator-decorated organism class into create options. */
  static async fromClass(
    target: Newable,
    overrides: Partial<CreateOrganismOptions> = {}
  ): Promise<OrganismRuntime> {
    const meta = (await import('../decorators')).getOrganismMetadata(target);
    if (!meta) {
      throw new OrganismStateError(`Class ${target.name} is not decorated with @Organism`);
    }
    const opts = OrganismRuntime.mergeDecoratorOptions(meta, overrides);
    return OrganismRuntime.create(opts);
  }

  private static mergeDecoratorOptions(
    meta: OrganismDecoratorOptions,
    overrides: Partial<CreateOrganismOptions>
  ): CreateOrganismOptions {
    if (!meta.mission && !overrides.mission) {
      throw new OrganismStateError('@Organism requires a mission');
    }
    return {
      mission: overrides.mission ?? (meta.mission as MissionDefinition | Newable),
      genes: overrides.genes ?? meta.genes,
      environment: overrides.environment ?? meta.environment,
      constitution: overrides.constitution ?? meta.constitution,
      resources: overrides.resources ?? meta.resources,
      id: overrides.id ?? meta.id,
      ...overrides,
    };
  }

  private async initialize(options: CreateOrganismOptions): Promise<void> {
    const mission = resolveMission(options.mission);
    const genes = (options.genes ?? []).map(resolveGene);
    const environment = options.environment ? resolveEnvironment(options.environment) : undefined;
    const constitution = options.constitution
      ? resolveConstitution(options.constitution)
      : undefined;
    const resources = options.resources
      ? resolveResource(options.resources)
      : ({
          tokenBudget: 5_000_000,
          monthlyBudget: { amount: 1000, currency: 'USD' },
        } as ResourceDefinition);

    const limits: OrganismLimits = { ...DEFAULT_ORGANISM_LIMITS, ...options.limits };
    const now = this.clock.now();

    this.record = {
      id: this.id,
      status: 'created',
      mission,
      constitution,
      environment,
      genes,
      resources,
      limits,
      cycles: options.cycles ?? {
        perception: '5s',
        evaluation: '1m',
        survival: '10m',
        missionEvaluation: '1m',
      },
      missionProgress: createMissionProgress(mission),
      pool: {
        tokensRemaining: resources.tokenBudget ?? 5_000_000,
        moneyRemaining: {
          amount: resources.monthlyBudget?.amount ?? 1000,
          currency: resources.monthlyBudget?.currency ?? 'USD',
        },
        costSpentThisHour: 0,
      },
      debug: this.debug,
      simulation: options.simulation ?? false,
      createdAt: now,
      updatedAt: now,
      emergencyStopped: false,
    };

    this.constitutionEnforcer = new ConstitutionEnforcer(constitution, this.events, this.id);
    const policyRules = this.constitutionEnforcer.toPolicyRules();
    if (policyRules.length) {
      this.agentRuntime = new AgentRuntime({
        llmProvider: options.llmProvider ?? createMockLlmProvider(),
        enableMetrics: true,
        enableRetry: false,
        enableCircuitBreaker: false,
        policyEngine: new PolicyEngine(policyRules),
      });
    }

    this.birthEngine = new BirthEngine(
      this.events,
      this.repo,
      this.capabilities,
      this.id,
      this.agentRuntime
    );
    this.terminationEngine = new TerminationEngine(
      this.events,
      this.repo,
      this.capabilities,
      this.id,
      (agent) => this.allocator.release(this.record, agent)
    );
    this.genealogyManager = new GenealogyManager(this.repo, this.id);
    this.reproductionEngine = new ReproductionEngine(
      this.events,
      this.repo,
      this.birthEngine,
      this.genealogyManager,
      this.constitutionEnforcer,
      this.id,
      () => this.clock.now(),
      this.reproductionConfig
    );
    this.mutationEngine = new MutationEngine(this.events, this.repo, this.id, () =>
      this.clock.now()
    );
    this.generationManager = new GenerationManager();
    this.evolutionEngine = new EvolutionEngine(
      this.events,
      this.repo,
      this.generationManager,
      this.mutationEngine,
      this.id,
      { ...DEFAULT_UTILITY_WEIGHTS },
      () => this.clock.now()
    );

    await this.repo.saveOrganism(this.record);
    await this.events.emit(OrganismEventType.ORGANISM_CREATED, this.id, {
      missionId: mission.id,
      objective: mission.objective,
    });
  }

  get status(): OrganismRecord['status'] {
    return this.record.status;
  }

  getMission(): MissionDefinition {
    return this.record.mission;
  }

  async start(): Promise<void> {
    if (this.record.emergencyStopped) {
      throw new OrganismStateError('Cannot start after emergency stop');
    }
    this.record.status = 'initializing';
    await this.persist();
    this.record.status = 'operating';
    await this.persist();
    this.startCycles();
    await this.events.emit(OrganismEventType.ORGANISM_STARTED, this.id, {
      status: this.record.status,
    });
    this.log(`[ORGANISM] Mission started: ${this.record.mission.objective}`);
  }

  async pause(): Promise<void> {
    this.stopCycles();
    this.record.status = 'paused';
    await this.persist();
    await this.events.emit(OrganismEventType.ORGANISM_PAUSED, this.id, {});
    this.log('[ORGANISM] Paused');
  }

  async resume(): Promise<void> {
    if (this.record.emergencyStopped) {
      throw new OrganismStateError('Cannot resume after emergency stop');
    }
    this.record.status = 'operating';
    await this.persist();
    this.startCycles();
    await this.events.emit(OrganismEventType.ORGANISM_RESUMED, this.id, {});
    this.log('[ORGANISM] Resumed');
  }

  async terminate(): Promise<void> {
    this.stopCycles();
    const agents = await this.liveAgents();
    for (const agent of agents) {
      await this.terminationEngine.terminate(agent.id, 'manual');
      this.metrics.recordTermination();
    }
    this.record.status = 'terminated';
    await this.persist();
    await this.events.emit(OrganismEventType.ORGANISM_TERMINATED, this.id, {});
    this.log('[ORGANISM] Terminated');
  }

  async emergencyStop(): Promise<void> {
    this.record.emergencyStopped = true;
    this.stopCycles();
    this.record.status = 'terminated';
    await this.persist();
    await this.events.emit(OrganismEventType.ORGANISM_EMERGENCY_STOP, this.id, {});
    this.log('[ORGANISM] Emergency stop');
  }

  async observe(
    raw: Partial<EnvironmentSignal> & Pick<EnvironmentSignal, 'type' | 'source'>
  ): Promise<OrganismDecision | undefined> {
    if (this.record.status === 'paused' || this.record.emergencyStopped) {
      return undefined;
    }
    this.record.status = 'observing';
    const signal = this.perception.normalize({
      ...raw,
      timestamp: raw.timestamp ?? this.clock.now(),
    });
    const filtered = this.perception.filter(signal, this.record.mission);
    await this.repo.appendSignal(this.id, filtered.signal);
    await this.events.emit(OrganismEventType.ENVIRONMENT_SIGNAL_RECEIVED, this.id, filtered.signal);
    this.log(`[ENVIRONMENT] ${signal.type} ${filtered.accepted ? 'accepted' : 'ignored'}`);

    if (!filtered.accepted) {
      this.record.status = 'operating';
      await this.persist();
      return {
        action: 'observe',
        reasoningSummary: filtered.reason,
        confidence: 1,
      };
    }

    const need = this.needDetector.detect(filtered.signal, this.record.mission);
    if (!need) {
      this.record.status = 'operating';
      await this.persist();
      return {
        action: 'observe',
        reasoningSummary: `No need detected for ${signal.type}`,
        confidence: 0.7,
      };
    }

    await this.events.emit(OrganismEventType.ORGANISM_NEED_DETECTED, this.id, need);
    this.log(`[NEED] ${need.need} — ${need.reason}`);

    this.record.status = 'planning';
    const live = await this.liveAgents();
    const spawnCheck = this.allocator.canSpawn(this.record, live.length);
    const decision = this.decisionEngine.decide({
      need,
      liveAgents: live,
      genes: this.record.genes,
      canSpawn: spawnCheck.ok,
      spawnBlockReason: spawnCheck.reason,
    });

    await this.repo.appendDecision(this.id, decision);
    await this.events.emit(OrganismEventType.ORGANISM_DECISION, this.id, decision);
    if (this.debug) {
      this.log(
        `[DECISION] ${decision.action}: ${decision.reasoningSummary} (confidence=${decision.confidence})`
      );
    }

    await this.applyDecision(decision);
    this.record.status = 'operating';
    await this.persist();
    return decision;
  }

  private async applyDecision(decision: OrganismDecision): Promise<void> {
    if (decision.action === 'delegate' && decision.targetAgentId) {
      await this.delegateInternal(decision.targetAgentId, decision.needId ?? 'task');
      return;
    }

    if (
      (decision.action === 'spawn' || decision.action === 'specialize') &&
      decision.birthProposal
    ) {
      await this.spawnFromProposal(decision);
      return;
    }

    if (decision.action === 'reproduce' && decision.birthProposal?.parentAgentId) {
      await this.reproduceAgent(decision.birthProposal.parentAgentId, {
        reason: decision.birthProposal.reason,
        specialization: decision.birthProposal.specialize,
        objective: decision.birthProposal.expectedOutcome,
        needId: decision.birthProposal.needId,
        confidence: decision.confidence,
        tokens: decision.resourceRequest?.tokens,
        terminationCriteria: decision.birthProposal.terminationCriteria,
      });
    }
  }

  private async spawnFromProposal(decision: OrganismDecision): Promise<RuntimeAgentRecord> {
    const proposal = decision.birthProposal!;
    this.constitutionEnforcer.assertAllows('spawn', {});

    const live = await this.liveAgents();
    const spawnCheck = this.allocator.canSpawn(this.record, live.length);
    if (!spawnCheck.ok) {
      throw new OrganismStateError(spawnCheck.reason);
    }

    const geneId = proposal.geneId ?? this.record.genes[0]?.id;
    const gene = this.record.genes.find((g) => g.id === geneId);
    if (!gene) {
      throw new OrganismStateError(`Gene not found: ${geneId}`);
    }

    const agentId = `pending_${Date.now()}`;
    const allocation = this.allocator.allocate(this.record, {
      agentId,
      requestedResources: decision.resourceRequest ?? { tokens: 50_000 },
      expectedUtility: proposal.expectedUtility ?? 0.5,
      confidence: proposal.confidence,
      urgency: 0.7,
    });
    if (!allocation.approved) {
      await this.events.emit(OrganismEventType.ORGANISM_RESOURCE_DENIED, this.id, allocation);
      throw new OrganismStateError(allocation.reason);
    }

    this.allocator.recordSpawn();
    const parentGeneration = proposal.parentAgentId
      ? ((await this.repo.getAgent(this.id, proposal.parentAgentId))?.generation ?? 0)
      : 0;
    const generation = parentGeneration + 1;
    if (generation > this.record.limits.maxGenerationDepth) {
      this.record.pool.tokensRemaining += allocation.wallet.tokensRemaining ?? 0;
      this.record.pool.moneyRemaining.amount += allocation.wallet.moneyRemaining?.amount ?? 0;
      throw new OrganismStateError(
        `maxGenerationDepth (${this.record.limits.maxGenerationDepth}) exceeded`
      );
    }

    const agent = await this.birthEngine.spawn({
      proposal,
      gene,
      wallet: allocation.wallet,
      generation,
      parentAgentId: proposal.parentAgentId,
    });
    this.agentCache.set(agent.id, agent);

    this.metrics.recordSpawn();
    this.metrics.recordTokens(allocation.wallet.tokensRemaining ?? 0);
    this.log(
      `[BIRTH] ${agent.name}#${agent.id} born parent: ${agent.parentAgentId ?? agent.geneId} generation: ${agent.generation}`
    );
    this.log(
      `[RESOURCE] allocated ${(allocation.wallet.tokensRemaining ?? 0).toLocaleString()} tokens`
    );

    if (decision.action === 'specialize') {
      await this.events.emit(OrganismEventType.ORGANISM_AGENT_SPECIALIZED, this.id, {
        agentId: agent.id,
        specialize: agent.specialize,
      });
    }

    await this.persist();
    return agent;
  }

  /** Public spawn API for explicit births (still requires structured proposal). */
  async spawnAgent(input: {
    reason: string;
    objective: string;
    needId: string;
    requiredCapabilities: string[];
    parentAgentId?: string;
    specialize?: string[];
    geneId?: string;
    confidence?: number;
    terminationCriteria?: string[];
    tokens?: number;
  }): Promise<RuntimeAgentRecord> {
    const gene =
      this.record.genes.find((g) => g.id === input.geneId) ??
      this.decisionEngine.selectGene(input.requiredCapabilities, this.record.genes);
    if (!gene) throw new OrganismStateError('No gene available for spawn');

    const decision: OrganismDecision = {
      action: input.specialize?.length ? 'specialize' : 'spawn',
      reasoningSummary: input.reason,
      confidence: input.confidence ?? 0.8,
      resourceRequest: { tokens: input.tokens ?? 50_000 },
      birthProposal: {
        reason: input.reason,
        needId: input.needId,
        requiredCapabilities: input.requiredCapabilities,
        expectedOutcome: input.objective,
        confidence: input.confidence ?? 0.8,
        geneId: gene.id,
        specialize: input.specialize,
        parentAgentId: input.parentAgentId,
        terminationCriteria: input.terminationCriteria,
      },
    };
    await this.repo.appendDecision(this.id, decision);
    return this.spawnFromProposal(decision);
  }

  async terminateAgent(
    agentId: string,
    opts: { reason: string } = { reason: 'manual' }
  ): Promise<void> {
    const agent = await this.terminationEngine.terminate(agentId, opts.reason);
    if (agent) {
      this.metrics.recordTermination();
      this.log(`[DEATH] ${agent.name}#${agent.id} terminated (${opts.reason})`);
      if ((agent.wallet.tokensRemaining ?? 0) === 0) {
        this.log(`[RESOURCE] unused tokens returned to pool`);
      }
    }
    await this.persist();
  }

  async reportOutcome(agentId: string, report: AgentOutcomeReport): Promise<void> {
    const agent = await this.repo.getAgent(this.id, agentId);
    if (!agent) throw new OrganismStateError(`Agent not found: ${agentId}`);

    agent.valueGenerated += report.metrics?.valueGenerated ?? 0;
    agent.costConsumed += report.metrics?.cost ?? 0;
    agent.tokensConsumed += report.metrics?.cost
      ? Math.floor((report.metrics.cost ?? 0) * 1000)
      : 0;
    agent.reputation = this.reputationEngine.update(agent, report);
    agent.utility = this.utilityEngine.evaluate(agent, report);
    agent.evaluationCount += 1;
    agent.lastEvaluatedAt = this.clock.now();
    await this.repo.saveAgent(this.id, agent);
    this.agentCache.set(agent.id, agent);

    if (report.missionMetricUpdates) {
      this.record.missionProgress = applyMissionMetricUpdates(
        this.record.missionProgress,
        this.record.mission,
        report.missionMetricUpdates
      );
      await this.events.emit(
        OrganismEventType.ORGANISM_MISSION_PROGRESS,
        this.id,
        this.record.missionProgress
      );
      if (this.record.missionProgress.completed) {
        this.record.status = 'completed';
        await this.events.emit(
          OrganismEventType.ORGANISM_MISSION_COMPLETED,
          this.id,
          this.record.missionProgress
        );
        this.log('[MISSION] Mission completed');
      }
    }

    this.log(`[RESULT] ${report.result}`);
    await this.persist();
  }

  async runSurvivalCycle(): Promise<SurvivalReport[]> {
    const agents = await this.liveAgents();
    const reports: SurvivalReport[] = [];
    for (const agent of agents) {
      const verdict = this.survivalEngine.evaluate(agent);
      reports.push(verdict);
      if (verdict.shouldTerminate) {
        this.log(`[SURVIVAL] ${agent.name}#${agent.id} ${verdict.reason}`);
        await this.terminateAgent(agent.id, { reason: 'low_value' });
      }
    }
    return reports;
  }

  async inspect(): Promise<OrganismInspectState> {
    const agents = await this.repo.listAgents(this.id);
    return {
      mission: this.record.mission,
      missionProgress: this.record.missionProgress,
      status: this.record.status,
      agents: agents.map((a) => ({
        id: a.id,
        objective: a.objective,
        capabilities: a.capabilities,
        parentId: a.parentAgentId,
        generation: a.generation,
        status: a.status,
        reputation: a.reputation,
        utility: a.utility,
        resourceConsumption: { tokens: a.tokensConsumed, cost: a.costConsumed },
      })),
      resources: {
        pool: this.record.pool,
        limits: this.record.limits,
      },
      recentSignals: await this.repo.listSignals(this.id, 20),
      recentDecisions: await this.repo.listDecisions(this.id, 20),
      genealogy: await this.repo.listGenealogy(this.id),
    };
  }

  async getGenealogy(): Promise<AgentGenealogy[]> {
    return this.repo.listGenealogy(this.id);
  }

  async formatGenealogy(): Promise<string> {
    const [agents, genealogy] = await Promise.all([
      this.repo.listAgents(this.id),
      this.genealogyManager.list(),
    ]);
    return this.genealogyManager.formatTree(agents, genealogy);
  }

  /**
   * Phase 2 — create a specialized descendant from an existing agent.
   */
  async reproduceAgent(
    parentAgentId: string,
    request: ReproduceRequest
  ): Promise<RuntimeAgentRecord> {
    const parent = await this.repo.getAgent(this.id, parentAgentId);
    if (!parent) throw new OrganismStateError(`Parent agent not found: ${parentAgentId}`);

    const gene = this.record.genes.find((g) => g.id === parent.geneId);
    if (!gene) throw new OrganismStateError(`Gene not found for parent: ${parent.geneId}`);

    const live = await this.liveAgents();
    const spawnCheck = this.allocator.canSpawn(this.record, live.length);
    if (!spawnCheck.ok) {
      throw new OrganismStateError(spawnCheck.reason);
    }

    // Prefer parent wallet transfer; optionally top up from pool if parent has no tokens
    const parentTokens = parent.wallet.tokensRemaining ?? 0;
    let poolWallet: import('../types/organism.types').AgentResourceWallet | undefined;
    if (parentTokens <= 0 || request.tokens) {
      const allocation = this.allocator.allocate(this.record, {
        agentId: `repro_${parentAgentId}`,
        requestedResources: { tokens: request.tokens ?? 25_000 },
        expectedUtility: parent.utility.score,
        confidence: request.confidence ?? 0.8,
        urgency: 0.6,
        reputationScore: parent.reputation.score,
      });
      if (!allocation.approved) {
        throw new OrganismStateError(allocation.reason);
      }
      poolWallet = allocation.wallet;
    }

    this.allocator.recordSpawn();
    const { child, parent: updatedParent } = await this.reproductionEngine.reproduce({
      parent,
      gene,
      request,
      limits: this.record.limits,
      liveAgents: live,
      poolWallet,
    });

    this.agentCache.set(child.id, child);
    this.agentCache.set(updatedParent.id, updatedParent);
    this.capabilities.register(child.id, child.capabilities);
    this.metrics.recordReproduction();
    this.metrics.recordTokens(child.wallet.tokensRemaining ?? 0);

    this.log(
      `[REPRODUCTION] ${child.name}#${child.id} born parent: ${parent.name}#${parent.id} generation: ${child.generation}`
    );
    await this.persist();
    return child;
  }

  /**
   * Phase 3 — apply a constrained, auditable mutation.
   */
  async mutateAgent(
    agentId: string,
    input: { reason: string; mutation: AgentMutation }
  ): Promise<RuntimeAgentRecord> {
    const agent = await this.repo.getAgent(this.id, agentId);
    if (!agent) throw new OrganismStateError(`Agent not found: ${agentId}`);
    const gene = this.record.genes.find((g) => g.id === agent.geneId);
    if (!gene) throw new OrganismStateError(`Gene not found: ${agent.geneId}`);

    this.constitutionEnforcer.assertAllows('mutate', {});
    const updated = await this.mutationEngine.mutate(agent, input, gene);
    this.capabilities.register(updated.id, updated.capabilities);
    this.agentCache.set(updated.id, updated);
    this.metrics.recordMutation();
    this.log(`[MUTATION] ${updated.name}#${updated.id}: ${input.reason}`);
    await this.persist();
    return updated;
  }

  /**
   * Phase 3 — evaluate a competing population and promote the winner's strategy id.
   */
  async evaluateGeneration(input: {
    population: string[];
    populationId?: string;
    promoteToLosers?: boolean;
  }): Promise<GenerationEvaluationResult> {
    const result = await this.evolutionEngine.evaluateGeneration(input);
    this.log(
      `[EVOLUTION] population=${result.populationId} winner=${result.winner} scores=${JSON.stringify(result.scores)}`
    );

    if (input.promoteToLosers && result.winner) {
      const winner = await this.repo.getAgent(this.id, result.winner);
      const gene = winner ? this.record.genes.find((g) => g.id === winner.geneId) : undefined;
      if (winner && gene) {
        for (const member of result.members) {
          if (member.agentId === result.winner) continue;
          await this.evolutionEngine.promoteStrategy({
            winnerId: result.winner,
            targetId: member.agentId,
            gene,
          });
          this.metrics.recordMutation();
        }
      }
    }

    await this.persist();
    return result;
  }

  getEvolutionaryHistory(limit = 50): import('../types/organism.types').EvolutionaryHistoryEntry[] {
    return this.generationManager.getHistory(limit);
  }

  /** Phase 4 — forecast expected utility / opportunity cost for a resource request. */
  async forecastUtility(input: {
    agentId: string;
    requested: ResourceRequest;
    expectedValue: number;
    confidence: number;
    urgency?: number;
  }): Promise<UtilityForecast> {
    const agent = await this.repo.getAgent(this.id, input.agentId);
    if (!agent) throw new OrganismStateError(`Agent not found: ${input.agentId}`);
    return this.forecaster.forecast({
      agent,
      record: this.record,
      requested: input.requested,
      expectedValue: input.expectedValue,
      confidence: input.confidence,
      urgency: input.urgency,
    });
  }

  /** Phase 4 — place a resource bid into the internal market. */
  placeBid(input: {
    agentId: string;
    reason: string;
    requested: ResourceRequest;
    expectedValue: number;
    confidence: number;
    urgency?: number;
    bidPrice?: number;
    ttlMs?: number;
  }): ResourceBid {
    const bid = this.marketEngine.placeBid(input);
    this.log(
      `[BID] ${bid.id} agent=${bid.agentId} value=${bid.expectedValue} tokens=${bid.requested.tokens ?? 0}`
    );
    return bid;
  }

  listOpenBids(): ResourceBid[] {
    return this.marketEngine.listOpenBids();
  }

  /** Phase 4 — clear open bids against the organism pool. */
  async clearMarket(): Promise<MarketClearingResult> {
    const agents = await this.repo.listAgents(this.id);
    const map = new Map(agents.map((a) => [a.id, a]));
    const result = this.marketEngine.clearMarket({ record: this.record, agents: map });

    for (const win of result.awarded) {
      const agent = map.get(win.agentId);
      if (!agent) continue;
      agent.wallet = {
        tokensRemaining: (agent.wallet.tokensRemaining ?? 0) + (win.wallet.tokensRemaining ?? 0),
        moneyRemaining: {
          amount:
            (agent.wallet.moneyRemaining?.amount ?? 0) + (win.wallet.moneyRemaining?.amount ?? 0),
          currency: this.record.pool.moneyRemaining.currency,
        },
      };
      await this.repo.saveAgent(this.id, agent);
      this.agentCache.set(agent.id, agent);
      this.metrics.recordTokens(win.wallet.tokensRemaining ?? 0);
    }

    // Persist any bid-price charges on losers/winners wallets
    for (const agent of map.values()) {
      await this.repo.saveAgent(this.id, agent);
      this.agentCache.set(agent.id, agent);
    }

    this.log(
      `[MARKET] cleared ${result.roundId}: awarded=${result.awarded.length} denied=${result.denied.length}`
    );
    await this.persist();
    return result;
  }

  /** Phase 4 — peer resource negotiation between two agents. */
  async negotiate(offer: NegotiationOffer): Promise<NegotiationResult> {
    const from = await this.repo.getAgent(this.id, offer.fromAgentId);
    const to = await this.repo.getAgent(this.id, offer.toAgentId);
    if (!from || !to) {
      return { approved: false, reason: 'Agent not found' };
    }
    const result = this.marketEngine.negotiate({
      offer,
      from,
      to,
      record: this.record,
    });
    if (result.approved) {
      await this.repo.saveAgent(this.id, from);
      await this.repo.saveAgent(this.id, to);
      this.agentCache.set(from.id, from);
      this.agentCache.set(to.id, to);
      this.log(
        `[NEGOTIATION] ${from.id} → ${to.id} tokens=${offer.transfer.tokens ?? 0} money=${offer.transfer.money ?? 0}`
      );
    }
    await this.persist();
    return result;
  }

  /**
   * Phase 4 — negotiate-aware resource request (forecast first, then allocate).
   */
  async requestResourcesForAgent(
    agentId: string,
    input: {
      reason: string;
      requested: ResourceRequest;
      expectedValue?: number;
      confidence?: number;
      urgency?: number;
      useMarket?: boolean;
    }
  ): Promise<{
    approved: boolean;
    reason: string;
    wallet?: import('../types/organism.types').AgentResourceWallet;
    forecast?: UtilityForecast;
  }> {
    const agent = await this.repo.getAgent(this.id, agentId);
    if (!agent) return { approved: false, reason: `Agent not found: ${agentId}` };

    const expectedValue = input.expectedValue ?? 100;
    const confidence = input.confidence ?? 0.5;
    const forecast = this.forecaster.forecast({
      agent,
      record: this.record,
      requested: input.requested,
      expectedValue,
      confidence,
      urgency: input.urgency,
    });

    if (input.useMarket) {
      this.placeBid({
        agentId,
        reason: input.reason,
        requested: input.requested,
        expectedValue,
        confidence,
        urgency: input.urgency,
      });
      const cleared = await this.clearMarket();
      const win = cleared.awarded.find((a) => a.agentId === agentId);
      if (win) {
        return {
          approved: true,
          reason: 'Won market clearing',
          wallet: win.wallet,
          forecast,
        };
      }
      const denial = cleared.denied.find((d) => d.agentId === agentId);
      return {
        approved: false,
        reason: denial?.reason ?? 'Lost market clearing',
        forecast,
      };
    }

    if (forecast.netExpectedValue < 0 && expectedValue > 0) {
      return {
        approved: false,
        reason: `Forecast net value negative (${forecast.netExpectedValue.toFixed(2)})`,
        forecast,
      };
    }

    const allocation = this.allocator.allocate(this.record, {
      agentId,
      requestedResources: input.requested,
      expectedUtility: forecast.expectedUtility,
      confidence,
      urgency: input.urgency ?? 0.5,
      reputationScore: agent.reputation.score,
    });
    if (allocation.approved) {
      agent.wallet = {
        tokensRemaining:
          (agent.wallet.tokensRemaining ?? 0) + (allocation.wallet.tokensRemaining ?? 0),
        moneyRemaining: {
          amount:
            (agent.wallet.moneyRemaining?.amount ?? 0) +
            (allocation.wallet.moneyRemaining?.amount ?? 0),
          currency: this.record.pool.moneyRemaining.currency,
        },
      };
      await this.repo.saveAgent(this.id, agent);
      this.agentCache.set(agent.id, agent);
      await this.persist();
    }
    return {
      approved: allocation.approved,
      reason: allocation.reason,
      wallet: allocation.wallet,
      forecast,
    };
  }

  getMarketHistory(limit = 20): MarketClearingResult[] {
    return this.marketEngine.getHistory(limit);
  }

  async getGraph(): Promise<OrganismGraph> {
    const agents = await this.repo.listAgents(this.id);
    const nodes = agents.map((a) => ({
      id: a.id,
      label: a.name,
      status: a.status,
      generation: a.generation,
      utility: a.utility.score,
      reputation: a.reputation.score,
      cost: a.costConsumed,
      tokens: a.tokensConsumed,
      objective: a.objective,
      geneId: a.geneId,
      parentId: a.parentAgentId,
    }));
    const edges = agents
      .filter((a) => a.parentAgentId)
      .map((a) => ({
        from: a.parentAgentId!,
        to: a.id,
        kind: 'parent' as const,
      }));
    return { nodes, edges };
  }

  createAgentContext(agentId: string): OrganismAgentContext {
    return new OrganismAgentContext({
      getMission: (): MissionDefinition => this.record.mission,
      getConstitution: (): ConstitutionDefinition | undefined => this.record.constitution,
      getWallet: (): import('../types/organism.types').AgentResourceWallet => {
        const agent = this.syncGetAgent(agentId);
        return agent?.wallet ?? {};
      },
      findAgents: async (query: { capabilities?: string[] }): Promise<RuntimeAgentRecord[]> => {
        const all = await this.liveAgents();
        if (!query.capabilities?.length) return all;
        return this.capabilities.findCapableAgents(query.capabilities, all);
      },
      delegate: async (input: {
        to: string;
        task: string;
      }): Promise<{ ok: boolean; result?: string }> => this.delegateInternal(input.to, input.task),
      requestResources: async (input: {
        reason: string;
        requested: import('../types/organism.types').ResourceRequest;
        expectedValue?: number;
        confidence?: number;
        urgency?: number;
        useMarket?: boolean;
      }): Promise<{
        approved: boolean;
        reason: string;
        wallet?: import('../types/organism.types').AgentResourceWallet;
        forecast?: UtilityForecast;
      }> => this.requestResourcesForAgent(agentId, input),
      placeBid: (input: {
        reason: string;
        requested: ResourceRequest;
        expectedValue: number;
        confidence: number;
        urgency?: number;
        bidPrice?: number;
      }): ResourceBid =>
        this.placeBid({
          agentId,
          ...input,
        }),
      negotiate: async (input: {
        toAgentId: string;
        reason: string;
        transfer: ResourceRequest;
        expectedValue?: number;
        confidence?: number;
      }): Promise<NegotiationResult> =>
        this.negotiate({
          fromAgentId: agentId,
          toAgentId: input.toAgentId,
          reason: input.reason,
          transfer: input.transfer,
          expectedValue: input.expectedValue,
          confidence: input.confidence,
        }),
      reportOutcome: async (report: AgentOutcomeReport): Promise<void> =>
        this.reportOutcome(agentId, report),
      requestApproval: async (input: {
        action: string;
        reason: string;
        risk?: number;
        expectedValue?: number;
      }): Promise<{ approved: boolean; reason: string }> => {
        const key = `${input.action}:${input.reason}`;
        if (this.pendingApprovals.has(key)) {
          return {
            approved: this.pendingApprovals.get(key)!,
            reason: 'Cached approval decision',
          };
        }
        const approved = (input.risk ?? 0) < 0.5;
        this.pendingApprovals.set(key, approved);
        return {
          approved,
          reason: approved ? 'Auto-approved low risk' : 'Requires human approval',
        };
      },
      spawn: async (input): Promise<RuntimeAgentRecord> =>
        this.spawnAgent({
          ...input,
          parentAgentId: agentId,
        }),
      reproduce: async (request: ReproduceRequest): Promise<RuntimeAgentRecord> =>
        this.reproduceAgent(agentId, request),
      mutate: async (input: {
        reason: string;
        mutation: AgentMutation;
      }): Promise<RuntimeAgentRecord> => this.mutateAgent(agentId, input),
    });
  }

  /** Grant/deny a pending human approval key (for tests / HITL bridge). */
  setApproval(action: string, reason: string, approved: boolean): void {
    this.pendingApprovals.set(`${action}:${reason}`, approved);
  }

  async simulate(options: SimulateOptions): Promise<OrganismInspectState> {
    this.record.simulation = true;
    if (options.environment?.clock !== 'real') {
      this.clock.useAccelerated(this.clock.now().getTime());
    }
    const log = options.onEvent ?? ((line: string): void => this.log(line));
    const prevLog = this.log;
    this.log = log;

    if (this.record.status === 'created') {
      await this.start();
    }

    const durationMs = parseDurationMs(options.duration, 86_400_000);
    const stepMs = options.stepMs ?? Math.max(1000, Math.floor(durationMs / 20));
    const signals = options.signals ?? [];
    let elapsed = 0;
    let signalIndex = 0;

    while (elapsed < durationMs && this.record.status !== 'terminated') {
      this.clock.advance(stepMs);
      elapsed += stepMs;

      if (signalIndex < signals.length) {
        const at = (signalIndex + 1) * (durationMs / (signals.length + 1));
        if (elapsed >= at) {
          await this.observe(signals[signalIndex]);
          signalIndex += 1;
        }
      }

      if (elapsed % parseDurationMs(this.record.cycles.survival, 600_000) < stepMs) {
        await this.runSurvivalCycle();
      }
    }

    this.log = prevLog;
    return this.inspect();
  }

  getAgentRuntime(): AgentRuntime {
    return this.agentRuntime;
  }

  getRecord(): OrganismRecord {
    return { ...this.record };
  }

  async listAgents(): Promise<RuntimeAgentRecord[]> {
    return this.repo.listAgents(this.id);
  }

  async listEvents(limit = 50): Promise<import('../events/organism-events').OrganismEvent[]> {
    return this.events.getHistory(limit);
  }

  private syncGetAgent(agentId: string): RuntimeAgentRecord | undefined {
    return this.agentCache.get(agentId);
  }

  private async liveAgents(): Promise<RuntimeAgentRecord[]> {
    const all = await this.repo.listAgents(this.id);
    for (const a of all) this.agentCache.set(a.id, a);
    return all.filter((a) => a.status !== 'terminated' && a.status !== 'failed');
  }

  private async delegateInternal(
    to: string,
    task: string
  ): Promise<{ ok: boolean; result?: string }> {
    const agent = await this.repo.getAgent(this.id, to);
    if (!agent || agent.status === 'terminated') {
      return { ok: false, result: 'Agent not available' };
    }
    agent.status = 'active';
    await this.repo.saveAgent(this.id, agent);
    this.agentCache.set(agent.id, agent);
    this.log(`[DELEGATE] task to ${agent.name}#${agent.id}: ${task}`);
    try {
      if (this.agentRuntime.getAgentMetadata(agent.dnaAgentName)) {
        await this.agentRuntime.execute(agent.dnaAgentName, task);
      }
    } catch {
      // mock / missing agent — still count as delegated assignment
    }
    return { ok: true, result: `Assigned: ${task}` };
  }

  private startCycles(): void {
    this.stopCycles();
    if (this.record.simulation || this.clock.isAccelerated) {
      // simulation drives cycles explicitly
      return;
    }
    const survivalMs = parseDurationMs(this.record.cycles.survival, 600_000);
    const timer = setInterval(() => {
      void this.runSurvivalCycle();
    }, survivalMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.cycleTimers.push(timer);
  }

  private stopCycles(): void {
    for (const t of this.cycleTimers) clearInterval(t);
    this.cycleTimers = [];
  }

  private async persist(): Promise<void> {
    this.record.updatedAt = this.clock.now();
    await this.repo.saveOrganism(this.record);
  }
}

export type SurvivalReport = import('../lifecycle/survival-engine').SurvivalVerdict;

export async function createOrganism(options: CreateOrganismOptions): Promise<OrganismRuntime> {
  return OrganismRuntime.create(options);
}
