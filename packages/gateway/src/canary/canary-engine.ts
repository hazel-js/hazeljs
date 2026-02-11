/**
 * Canary Deployment Engine
 *
 * The differentiator feature of @hazeljs/gateway.
 *
 * Tracks real-time error rates and latency per service version,
 * automatically promotes canary traffic through configurable steps,
 * and rolls back if error thresholds are breached.
 *
 * States:
 *   ACTIVE     -> canary is receiving traffic at current weight
 *   PROMOTED   -> canary promoted to 100%, rollout complete
 *   ROLLED_BACK -> canary failed, all traffic to stable
 *   PAUSED     -> manual pause, no automatic transitions
 */

import { EventEmitter } from 'events';
import { MetricsCollector } from '@hazeljs/resilience';
import {
  CanaryConfig,
  CanaryState,
  CanaryMetrics,
  CanaryVersionMetrics,
  CanaryDecision,
  ProxyRequest,
} from '../types';

export interface CanaryStatus {
  state: CanaryState;
  stableVersion: string;
  canaryVersion: string;
  currentStableWeight: number;
  currentCanaryWeight: number;
  currentStep: number;
  totalSteps: number;
  metrics: CanaryMetrics;
  lastEvaluation?: Date;
  lastTransition?: Date;
}

export class CanaryEngine extends EventEmitter {
  private state: CanaryState = CanaryState.ACTIVE;
  private config: CanaryConfig;
  private stableMetrics: MetricsCollector;
  private canaryMetrics: MetricsCollector;
  private currentStableWeight: number;
  private currentCanaryWeight: number;
  private currentStepIndex: number = 0;
  private evaluationTimer?: NodeJS.Timeout;
  private promotionTimer?: NodeJS.Timeout;
  private lastEvaluation?: Date;
  private lastTransition?: Date;
  private evaluationWindowMs: number;
  private stepIntervalMs: number;

  constructor(config: CanaryConfig) {
    super();
    this.config = config;
    this.currentStableWeight = config.stable.weight;
    this.currentCanaryWeight = config.canary.weight;

    this.evaluationWindowMs = parseInterval(config.promotion.evaluationWindow);
    this.stepIntervalMs = parseInterval(config.promotion.stepInterval);

    // Initialize metrics collectors with evaluation window
    this.stableMetrics = new MetricsCollector(this.evaluationWindowMs);
    this.canaryMetrics = new MetricsCollector(this.evaluationWindowMs);

    // Find the initial step index based on current canary weight
    this.currentStepIndex = this.findStepIndex(config.canary.weight);
  }

  /**
   * Start the canary evaluation loop
   */
  start(): void {
    if (this.state !== CanaryState.ACTIVE) return;

    // Schedule periodic evaluation
    this.evaluationTimer = setInterval(() => {
      this.evaluate();
    }, this.evaluationWindowMs);

    this.emit('canary:started', {
      stable: this.config.stable.version,
      canary: this.config.canary.version,
      weight: this.currentCanaryWeight,
    });
  }

  /**
   * Stop the canary evaluation loop
   */
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }
    if (this.promotionTimer) {
      clearTimeout(this.promotionTimer);
      this.promotionTimer = undefined;
    }
  }

  /**
   * Route a request: returns 'stable' or 'canary' based on current weights
   */
  selectVersion(_request: ProxyRequest): 'stable' | 'canary' {
    if (this.state === CanaryState.ROLLED_BACK) return 'stable';
    if (this.state === CanaryState.PROMOTED) return 'canary';

    // Weighted random selection
    const random = Math.random() * 100;
    return random < this.currentCanaryWeight ? 'canary' : 'stable';
  }

  /**
   * Record a successful request for a version
   */
  recordSuccess(target: 'stable' | 'canary', duration: number): void {
    if (target === 'stable') {
      this.stableMetrics.recordSuccess(duration);
    } else {
      this.canaryMetrics.recordSuccess(duration);
    }
  }

  /**
   * Record a failed request for a version
   */
  recordFailure(target: 'stable' | 'canary', duration: number, error?: string): void {
    if (target === 'stable') {
      this.stableMetrics.recordFailure(duration, error);
    } else {
      this.canaryMetrics.recordFailure(duration, error);
    }
  }

  /**
   * Get the current canary status
   */
  getStatus(): CanaryStatus {
    return {
      state: this.state,
      stableVersion: this.config.stable.version,
      canaryVersion: this.config.canary.version,
      currentStableWeight: this.currentStableWeight,
      currentCanaryWeight: this.currentCanaryWeight,
      currentStep: this.currentStepIndex,
      totalSteps: this.config.promotion.steps.length,
      metrics: this.getMetrics(),
      lastEvaluation: this.lastEvaluation,
      lastTransition: this.lastTransition,
    };
  }

  /**
   * Get current metrics for both versions
   */
  getMetrics(): CanaryMetrics {
    const stableSnapshot = this.stableMetrics.getSnapshot();
    const canarySnapshot = this.canaryMetrics.getSnapshot();

    return {
      stable: {
        totalRequests: stableSnapshot.totalCalls,
        errorCount: stableSnapshot.failureCalls,
        errorRate: stableSnapshot.failureRate,
        averageLatency: stableSnapshot.averageResponseTime,
        p99Latency: stableSnapshot.p99ResponseTime,
      },
      canary: {
        totalRequests: canarySnapshot.totalCalls,
        errorCount: canarySnapshot.failureCalls,
        errorRate: canarySnapshot.failureRate,
        averageLatency: canarySnapshot.averageResponseTime,
        p99Latency: canarySnapshot.p99ResponseTime,
      },
    };
  }

  /**
   * Get the version string for a target
   */
  getVersion(target: 'stable' | 'canary'): string {
    return target === 'stable'
      ? this.config.stable.version
      : this.config.canary.version;
  }

  /**
   * Manually promote to the next step
   */
  promote(): void {
    this.doPromote();
  }

  /**
   * Manually rollback the canary
   */
  rollback(): void {
    this.doRollback('manual');
  }

  /**
   * Manually pause the canary
   */
  pause(): void {
    this.state = CanaryState.PAUSED;
    this.stop();
    this.emit('canary:paused', this.getStatus());
  }

  /**
   * Resume a paused canary
   */
  resume(): void {
    if (this.state !== CanaryState.PAUSED) return;
    this.state = CanaryState.ACTIVE;
    this.start();
    this.emit('canary:resumed', this.getStatus());
  }

  // ─── Evaluation ───

  private evaluate(): void {
    if (this.state !== CanaryState.ACTIVE) return;

    this.lastEvaluation = new Date();
    const metrics = this.getMetrics();

    // Check minimum requests threshold
    const minRequests = this.config.promotion.minRequests ?? 10;
    if (metrics.canary.totalRequests < minRequests) {
      return; // Not enough data to evaluate
    }

    const decision = this.makeDecision(metrics);

    switch (decision) {
      case 'promote':
        if (this.config.promotion.autoPromote) {
          this.schedulePromotion();
        }
        break;
      case 'rollback':
        if (this.config.promotion.autoRollback) {
          this.doRollback('auto');
        }
        break;
      case 'hold':
        // Do nothing, wait for next evaluation
        break;
    }
  }

  private makeDecision(metrics: CanaryMetrics): CanaryDecision {
    // Custom evaluator takes priority
    if (this.config.promotion.customEvaluator) {
      return this.config.promotion.customEvaluator(metrics);
    }

    const strategy = this.config.promotion.strategy;

    if (strategy === 'error-rate') {
      return this.evaluateByErrorRate(metrics);
    }

    if (strategy === 'latency') {
      return this.evaluateByLatency(metrics);
    }

    return 'hold';
  }

  private evaluateByErrorRate(metrics: CanaryMetrics): CanaryDecision {
    const threshold = this.config.promotion.errorThreshold ?? 5;

    // If canary error rate exceeds threshold, rollback
    if (metrics.canary.errorRate > threshold) {
      return 'rollback';
    }

    // If canary error rate is within threshold, promote
    if (metrics.canary.errorRate <= threshold) {
      return 'promote';
    }

    return 'hold';
  }

  private evaluateByLatency(metrics: CanaryMetrics): CanaryDecision {
    const threshold = this.config.promotion.latencyThreshold ?? 1000;

    // If canary p99 latency exceeds threshold, rollback
    if (metrics.canary.p99Latency > threshold) {
      return 'rollback';
    }

    // If canary latency is acceptable, promote
    return 'promote';
  }

  private schedulePromotion(): void {
    // If already at the last step, we're done
    if (this.currentStepIndex >= this.config.promotion.steps.length - 1) {
      this.doPromote();
      return;
    }

    // If a promotion is already scheduled, don't double-schedule
    if (this.promotionTimer) return;

    // Schedule the next step
    this.promotionTimer = setTimeout(() => {
      this.promotionTimer = undefined;
      this.doPromote();
    }, this.stepIntervalMs);
  }

  private doPromote(): void {
    if (this.state !== CanaryState.ACTIVE) return;

    this.currentStepIndex++;
    this.lastTransition = new Date();

    if (this.currentStepIndex >= this.config.promotion.steps.length) {
      // Fully promoted
      this.currentCanaryWeight = 100;
      this.currentStableWeight = 0;
      this.state = CanaryState.PROMOTED;
      this.stop();

      this.emit('canary:complete', {
        version: this.config.canary.version,
        metrics: this.getMetrics(),
      });
      return;
    }

    // Move to the next weight step
    const newWeight = this.config.promotion.steps[this.currentStepIndex];
    this.currentCanaryWeight = newWeight;
    this.currentStableWeight = 100 - newWeight;

    this.emit('canary:promote', {
      step: this.currentStepIndex,
      totalSteps: this.config.promotion.steps.length,
      canaryWeight: this.currentCanaryWeight,
      stableWeight: this.currentStableWeight,
      metrics: this.getMetrics(),
    });
  }

  private doRollback(trigger: 'auto' | 'manual'): void {
    this.state = CanaryState.ROLLED_BACK;
    this.currentCanaryWeight = 0;
    this.currentStableWeight = 100;
    this.lastTransition = new Date();
    this.stop();

    this.emit('canary:rollback', {
      trigger,
      canaryVersion: this.config.canary.version,
      stableVersion: this.config.stable.version,
      metrics: this.getMetrics(),
    });
  }

  private findStepIndex(weight: number): number {
    const steps = this.config.promotion.steps;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] >= weight) return i;
    }
    return 0;
  }
}

// ─── Utilities ───

/**
 * Parse an interval string like '5m', '10s', '1h' to milliseconds.
 * Also accepts raw numbers (treated as ms).
 */
export function parseInterval(value: number | string): number {
  if (typeof value === 'number') return value;

  const match = value.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid interval format: "${value}". Use formats like "5m", "30s", "1h", or a number in ms.`);
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    default:
      return amount;
  }
}
