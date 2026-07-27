/**
 * Agent OS Phase 3 — Cost Optimizer (auto model select)
 */

export type ModelTier = 'economy' | 'balanced' | 'premium';

export interface ModelCostProfile {
  id: string;
  provider: string;
  tier: ModelTier;
  /** USD per 1K input tokens */
  inputPer1k: number;
  /** USD per 1K output tokens */
  outputPer1k: number;
  /** Relative quality 0–1 */
  quality: number;
  maxContext?: number;
}

export interface CostRouteRequest {
  /** Prefer lower cost vs higher quality (0 = cheapest, 1 = best quality). Default 0.5 */
  qualityBias?: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  /** Hard max USD for this call */
  maxCostUsd?: number;
  requireTier?: ModelTier[];
}

export const DEFAULT_MODEL_PROFILES: ModelCostProfile[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    tier: 'economy',
    inputPer1k: 0.00015,
    outputPer1k: 0.0006,
    quality: 0.7,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    tier: 'balanced',
    inputPer1k: 0.0025,
    outputPer1k: 0.01,
    quality: 0.9,
  },
  {
    id: 'o1',
    provider: 'openai',
    tier: 'premium',
    inputPer1k: 0.015,
    outputPer1k: 0.06,
    quality: 0.98,
  },
  {
    id: 'claude-haiku',
    provider: 'anthropic',
    tier: 'economy',
    inputPer1k: 0.00025,
    outputPer1k: 0.00125,
    quality: 0.72,
  },
  {
    id: 'claude-sonnet',
    provider: 'anthropic',
    tier: 'balanced',
    inputPer1k: 0.003,
    outputPer1k: 0.015,
    quality: 0.92,
  },
];

export function estimateCost(
  profile: ModelCostProfile,
  inputTokens: number,
  outputTokens: number
): number {
  return (inputTokens / 1000) * profile.inputPer1k + (outputTokens / 1000) * profile.outputPer1k;
}

export class CostOptimizer {
  constructor(private profiles: ModelCostProfile[] = DEFAULT_MODEL_PROFILES) {}

  setProfiles(profiles: ModelCostProfile[]): void {
    this.profiles = profiles;
  }

  selectModel(req: CostRouteRequest = {}): ModelCostProfile {
    const bias = req.qualityBias ?? 0.5;
    const inTok = req.estimatedInputTokens ?? 1000;
    const outTok = req.estimatedOutputTokens ?? 500;

    let candidates = [...this.profiles];
    if (req.requireTier?.length) {
      candidates = candidates.filter((p) => req.requireTier!.includes(p.tier));
    }

    const scored = candidates
      .map((p) => {
        const cost = estimateCost(p, inTok, outTok);
        return { p, cost, score: bias * p.quality - (1 - bias) * Math.min(1, cost * 50) };
      })
      .filter((x) => req.maxCostUsd == null || x.cost <= req.maxCostUsd)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      throw new Error('No model profiles satisfy cost/tier constraints');
    }
    return scored[0].p;
  }
}
