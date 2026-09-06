import type {
  AgentResourceWallet,
  OrganismLimits,
  OrganismRecord,
  ResourceRequest,
  RuntimeAgentRecord,
} from '../types/organism.types';
import { OrganismResourceDeniedError } from '../errors/organism.errors';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';

export interface AllocationRequest {
  agentId: string;
  requestedResources: ResourceRequest;
  expectedUtility: number;
  confidence: number;
  urgency: number;
  reputationScore?: number;
  missionPriority?: number;
}

export interface AllocationResult {
  approved: boolean;
  wallet: AgentResourceWallet;
  score: number;
  reason: string;
}

/**
 * Deterministic weighted resource allocator.
 */
export class ResourceAllocator {
  private spawnTimestamps: number[] = [];

  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly organismId: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  score(request: AllocationRequest): number {
    const utility = clamp(request.expectedUtility, 0, 1);
    const confidence = clamp(request.confidence, 0, 1);
    const urgency = clamp(request.urgency, 0, 1);
    const reputation = clamp(request.reputationScore ?? 0.5, 0, 1);
    const priority = clamp(request.missionPriority ?? 0.5, 0, 1);
    return utility * 0.3 + confidence * 0.2 + urgency * 0.2 + reputation * 0.2 + priority * 0.1;
  }

  canSpawn(record: OrganismRecord, liveAgentCount: number): { ok: boolean; reason: string } {
    if (record.emergencyStopped) {
      return { ok: false, reason: 'Emergency stop active' };
    }
    if (record.status === 'paused' || record.status === 'terminated') {
      return { ok: false, reason: `Organism is ${record.status}` };
    }
    if (liveAgentCount >= record.limits.maxAgents) {
      return { ok: false, reason: `maxAgents (${record.limits.maxAgents}) reached` };
    }
    const now = this.now().getTime();
    this.spawnTimestamps = this.spawnTimestamps.filter((t) => now - t < 60_000);
    if (this.spawnTimestamps.length >= record.limits.maxSpawnRatePerMinute) {
      return {
        ok: false,
        reason: `maxSpawnRatePerMinute (${record.limits.maxSpawnRatePerMinute}) exceeded`,
      };
    }
    if (record.pool.costSpentThisHour >= record.limits.maxTotalCostPerHour) {
      return {
        ok: false,
        reason: `maxTotalCostPerHour ($${record.limits.maxTotalCostPerHour}) exceeded`,
      };
    }
    return { ok: true, reason: 'ok' };
  }

  recordSpawn(): void {
    this.spawnTimestamps.push(this.now().getTime());
  }

  allocate(record: OrganismRecord, request: AllocationRequest): AllocationResult {
    const score = this.score(request);
    const tokens = request.requestedResources.tokens ?? 0;
    const money = request.requestedResources.money ?? 0;

    if (tokens > record.pool.tokensRemaining) {
      const result: AllocationResult = {
        approved: false,
        wallet: {},
        score,
        reason: `Insufficient tokens (need ${tokens}, have ${record.pool.tokensRemaining})`,
      };
      void this.events.emit(OrganismEventType.ORGANISM_RESOURCE_DENIED, this.organismId, {
        agentId: request.agentId,
        ...result,
      });
      return result;
    }

    if (money > record.pool.moneyRemaining.amount) {
      const result: AllocationResult = {
        approved: false,
        wallet: {},
        score,
        reason: `Insufficient money (need ${money}, have ${record.pool.moneyRemaining.amount})`,
      };
      void this.events.emit(OrganismEventType.ORGANISM_RESOURCE_DENIED, this.organismId, {
        agentId: request.agentId,
        ...result,
      });
      return result;
    }

    if (score < 0.15 && (tokens > 0 || money > 0)) {
      const result: AllocationResult = {
        approved: false,
        wallet: {},
        score,
        reason: `Allocation score too low (${score.toFixed(3)})`,
      };
      void this.events.emit(OrganismEventType.ORGANISM_RESOURCE_DENIED, this.organismId, {
        agentId: request.agentId,
        ...result,
      });
      return result;
    }

    record.pool.tokensRemaining -= tokens;
    record.pool.moneyRemaining.amount -= money;

    const wallet: AgentResourceWallet = {
      tokensRemaining: tokens || undefined,
      moneyRemaining:
        money > 0 ? { amount: money, currency: record.pool.moneyRemaining.currency } : undefined,
      computeUnitsRemaining: request.requestedResources.computeUnits,
      toolCallsRemaining: request.requestedResources.toolCalls,
    };

    const result: AllocationResult = {
      approved: true,
      wallet,
      score,
      reason: 'Allocated',
    };
    void this.events.emit(OrganismEventType.ORGANISM_RESOURCE_ALLOCATED, this.organismId, {
      agentId: request.agentId,
      wallet,
      score,
    });
    return result;
  }

  release(record: OrganismRecord, agent: RuntimeAgentRecord): void {
    const tokens = agent.wallet.tokensRemaining ?? 0;
    const money = agent.wallet.moneyRemaining?.amount ?? 0;
    record.pool.tokensRemaining += tokens;
    record.pool.moneyRemaining.amount += money;
    agent.wallet = {
      tokensRemaining: 0,
      moneyRemaining: {
        amount: 0,
        currency: record.pool.moneyRemaining.currency,
      },
    };
  }

  assertWithinLimits(_limits: OrganismLimits): void {
    // reserved for future hard asserts
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function createEmptyWallet(): AgentResourceWallet {
  return {
    tokensRemaining: 0,
    moneyRemaining: { amount: 0, currency: 'USD' },
    computeUnitsRemaining: 0,
    toolCallsRemaining: 0,
  };
}

export function throwIfDenied(result: AllocationResult): void {
  if (!result.approved) {
    throw new OrganismResourceDeniedError(result.reason);
  }
}
