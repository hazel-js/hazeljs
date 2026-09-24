/**
 * Cost / latency aware provider routing helpers + shadow registration.
 * Extension points only — no aggressive optimization in v1.
 */

import type { DecisionRiskObject } from '../types';
import type { ProviderRouterHook } from './provider-registry';
import type { DecisionProvider } from './decision-provider';
import type { DecisionProviderRegistry } from './provider-registry';
import type { DecisionLab } from '../lab/decision-lab';
import type { DecisionRequest } from '../types';

export interface ProviderCostProfile {
  name: string;
  /** Relative cost tier (lower = cheaper). */
  costTier: 'economy' | 'balanced' | 'premium';
  /** Estimated p95 latency ms. */
  p95LatencyMs?: number;
  /** Minimum risk level this provider may handle. */
  minRisk?: 'low' | 'medium' | 'high' | 'critical';
}

const RISK_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Build an auto-router that prefers cheaper providers when risk allows.
 */
export function createCostAwareRouter(profiles: ProviderCostProfile[]): ProviderRouterHook {
  const byName = new Map(profiles.map((p) => [p.name, p]));
  return ({ risk, available }) => {
    const riskLevel = risk.level;
    const riskRank = RISK_RANK[riskLevel] ?? 2;

    const eligible = available
      .map((name) => byName.get(name) ?? { name, costTier: 'balanced' as const })
      .filter((p) => {
        if (!p.minRisk) return true;
        return RISK_RANK[p.minRisk] <= riskRank;
      });

    // Prefer economy for low, balanced for medium, premium for high/critical
    const preferredTier =
      riskLevel === 'low'
        ? ['economy', 'balanced', 'premium']
        : riskLevel === 'medium'
          ? ['balanced', 'economy', 'premium']
          : ['premium', 'balanced', 'economy'];

    for (const tier of preferredTier) {
      const hit = eligible.find((p) => p.costTier === tier && available.includes(p.name));
      if (hit) return hit.name;
    }

    if (available.includes('hazel-agent')) return 'hazel-agent';
    return available[0];
  };
}

/**
 * Register a shadow provider: DecisionLab.compare can include it;
 * never use for production execute paths without explicit opt-in.
 */
export function registerShadowProvider(
  registry: DecisionProviderRegistry,
  provider: DecisionProvider
): void {
  // Shadow providers are normal registry entries; execution safety is enforced
  // by DecisionLab.compare (execute: false) and by callers not requesting execute.
  registry.register(provider);
}

/**
 * Run a primary decision + optional shadow compare without executing either.
 */
export async function runWithShadow(
  lab: DecisionLab,
  request: DecisionRequest,
  shadowProviders: string[]
): Promise<{
  primary: Awaited<ReturnType<DecisionLab['run']>>;
  shadows: Awaited<ReturnType<DecisionLab['compare']>>;
}> {
  const primary = await lab.run({
    ...request,
    execute: false,
  });
  const shadows = await lab.compare({ ...request, execute: false }, shadowProviders);
  return { primary, shadows };
}

/** Helper for typing risk into cost router without casting at call sites. */
export function riskObject(level: DecisionRiskObject['level']): DecisionRiskObject {
  return { level };
}
