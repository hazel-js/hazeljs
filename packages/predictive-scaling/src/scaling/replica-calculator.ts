import { CostOptimizationOptions, ForecastResult, ScalingDecision } from '../types';
import { clamp } from '../utils/duration';

export interface ReplicaCalculationInput {
  currentReplicas: number;
  predictedLoad: number;
  capacityPerReplica: number;
  maxReplicas: number;
  minReplicas: number;
  confidence: number;
  forecast?: ForecastResult;
}

export function calculateTargetReplicas(input: ReplicaCalculationInput): number {
  const needed = Math.ceil(input.predictedLoad / Math.max(1, input.capacityPerReplica));
  return clamp(needed, input.minReplicas, input.maxReplicas);
}

export function decideScaling(
  input: ReplicaCalculationInput,
  cost: CostOptimizationOptions = {}
): ScalingDecision {
  const enabled = cost.enabled ?? true;
  const minConfidence = cost.minConfidence ?? 0.7;
  const headroom = cost.scaleUpHeadroom ?? 1.2;
  const maxScaleDown = cost.maxScaleDownPerCycle ?? 1;

  const targetReplicas = calculateTargetReplicas(input);

  if (enabled && input.confidence < minConfidence) {
    return {
      action: 'hold',
      targetReplicas: input.currentReplicas,
      reason: `Confidence ${input.confidence.toFixed(2)} below threshold ${minConfidence}`,
      confidence: input.confidence,
      forecast: input.forecast,
    };
  }

  const predictedThreshold = input.currentReplicas * input.capacityPerReplica * headroom;

  if (input.predictedLoad > predictedThreshold && targetReplicas > input.currentReplicas) {
    return {
      action: 'scale-up',
      targetReplicas,
      reason: `Predicted load ${input.predictedLoad.toFixed(1)} exceeds headroom`,
      confidence: input.confidence,
      forecast: input.forecast,
    };
  }

  if (targetReplicas < input.currentReplicas) {
    const gradualTarget = enabled
      ? Math.max(targetReplicas, input.currentReplicas - maxScaleDown)
      : targetReplicas;

    if (gradualTarget < input.currentReplicas) {
      return {
        action: 'scale-down',
        targetReplicas: gradualTarget,
        reason: 'Predicted load decreased',
        confidence: input.confidence,
        forecast: input.forecast,
      };
    }
  }

  return {
    action: 'hold',
    targetReplicas: input.currentReplicas,
    reason: 'Within optimal range',
    confidence: input.confidence,
    forecast: input.forecast,
  };
}
