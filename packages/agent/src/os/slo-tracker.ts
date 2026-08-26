/**
 * Rolling SLO tracker for deployed agents. Emits AgentEventType.SLO_BREACHED.
 */

import type { AgentDnaSlo } from '../dna/agent-dna';
import { AgentEventType } from '../types/event.types';

export interface SloSample {
  agentId: string;
  success: boolean;
  durationMs: number;
  costUsd?: number;
  at: Date;
}

export interface SloHealth {
  agentId: string;
  target: AgentDnaSlo;
  current: {
    successRate: number;
    avgResponseTimeMs: number;
    avgCostPerRun?: number;
    samples: number;
  };
  healthy: boolean;
  breaches: Array<{ metric: string; target: number; current: number }>;
}

export type SloBreachEmitter = (
  type: AgentEventType,
  agentId: string,
  executionId: string,
  data: unknown
) => void | Promise<void>;

export class SloTracker {
  private readonly samples = new Map<string, SloSample[]>();
  private readonly targets = new Map<string, AgentDnaSlo>();

  constructor(
    private readonly emit?: SloBreachEmitter,
    private readonly windowSize = 50
  ) {}

  setTarget(agentId: string, slo?: AgentDnaSlo): void {
    if (slo) this.targets.set(agentId, slo);
    else this.targets.delete(agentId);
  }

  record(sample: SloSample): SloHealth | undefined {
    const list = this.samples.get(sample.agentId) ?? [];
    list.push(sample);
    if (list.length > this.windowSize) list.splice(0, list.length - this.windowSize);
    this.samples.set(sample.agentId, list);
    const health = this.evaluate(sample.agentId);
    if (health && !health.healthy) {
      void this.emit?.(AgentEventType.SLO_BREACHED, sample.agentId, '', {
        ...health,
        at: sample.at.toISOString(),
      });
    }
    return health;
  }

  evaluate(agentId: string): SloHealth | undefined {
    const target = this.targets.get(agentId);
    if (!target) return undefined;
    const list = this.samples.get(agentId) ?? [];
    if (!list.length) {
      return {
        agentId,
        target,
        current: { successRate: 1, avgResponseTimeMs: 0, samples: 0 },
        healthy: true,
        breaches: [],
      };
    }
    const successRate = list.filter((s) => s.success).length / list.length;
    const avgResponseTimeMs = list.reduce((s, x) => s + x.durationMs, 0) / list.length;
    const costSamples = list.filter((s) => s.costUsd != null);
    const avgCostPerRun = costSamples.length
      ? costSamples.reduce((s, x) => s + (x.costUsd ?? 0), 0) / costSamples.length
      : undefined;

    const breaches: SloHealth['breaches'] = [];
    if (target.successRate != null && successRate < target.successRate) {
      breaches.push({ metric: 'successRate', target: target.successRate, current: successRate });
    }
    if (target.maxResponseTimeMs != null && avgResponseTimeMs > target.maxResponseTimeMs) {
      breaches.push({
        metric: 'maxResponseTimeMs',
        target: target.maxResponseTimeMs,
        current: avgResponseTimeMs,
      });
    }
    if (
      target.maxCostPerRun != null &&
      avgCostPerRun != null &&
      avgCostPerRun > target.maxCostPerRun
    ) {
      breaches.push({
        metric: 'maxCostPerRun',
        target: target.maxCostPerRun,
        current: avgCostPerRun,
      });
    }

    return {
      agentId,
      target,
      current: { successRate, avgResponseTimeMs, avgCostPerRun, samples: list.length },
      healthy: breaches.length === 0,
      breaches,
    };
  }

  list(): SloHealth[] {
    return Array.from(this.targets.keys())
      .map((id) => this.evaluate(id))
      .filter((h): h is SloHealth => Boolean(h));
  }
}
