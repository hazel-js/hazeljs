import { ErrorDiagnostician } from '../diagnosis/error-diagnostician';
import { resolveGlobalHazelAIDiagnosticsProvider } from '../integrations/hazel-ai';
import { ConfigSnapshotStore } from '../config/config-snapshot-store';
import { createGracefulDrainCoordinator, GracefulDrainCoordinator } from '../drain/graceful-drain';
import { createHealingNotifierChain } from '../notifications/healing-notifiers';
import { PerformanceMonitor } from '../performance/performance-monitor';
import { createStrategy } from './strategies';
import {
  AIDiagnosticsProvider,
  ConfigSnapshot,
  HealingAttemptResult,
  HealingContext,
  HealingNotifier,
  HealingNotifyEvent,
  HealingStrategyName,
  SelfHealMethodOptions,
  SelfHealingModuleOptions,
} from '../types';

const DEFAULT_STRATEGIES: HealingStrategyName[] = [
  'auto-restart',
  'config-rollback',
  'memory-cleanup',
];

/**
 * Coordinates diagnosis and healing strategy execution.
 */
export class HealingCoordinator {
  private readonly diagnostician: ErrorDiagnostician;
  private readonly moduleOptions: SelfHealingModuleOptions;
  private readonly configStore = new ConfigSnapshotStore();
  private readonly notifiers: HealingNotifier[];
  private readonly drainCoordinator?: GracefulDrainCoordinator;
  private readonly performanceMonitor?: PerformanceMonitor;

  constructor(options: SelfHealingModuleOptions = {}) {
    const aiProvider = this.resolveAIDiagnostics(options.aiDiagnostics);

    this.diagnostician = new ErrorDiagnostician(aiProvider);
    this.moduleOptions = {
      enabled: true,
      strategies: DEFAULT_STRATEGIES,
      notifyOn: [
        'critical-healing',
        'auto-rollback',
        'healing-failed',
        'pod-restart',
        'hpa-boost',
        'graceful-drain',
        'performance-degradation',
      ],
      ...options,
    };
    this.notifiers = this.resolveNotifiers(options.notifications);

    if (options.drain) {
      const drainOptions = typeof options.drain === 'object' ? options.drain : {};
      this.drainCoordinator = createGracefulDrainCoordinator(drainOptions);
    }

    if (options.performance?.enabled) {
      this.performanceMonitor = new PerformanceMonitor(options.performance.thresholds);
    }
  }

  getDrainCoordinator(): GracefulDrainCoordinator | undefined {
    return this.drainCoordinator;
  }

  getPerformanceMonitor(): PerformanceMonitor | undefined {
    return this.performanceMonitor;
  }

  /**
   * Record method latency and optionally trigger HPA boost on critical degradation.
   */
  async recordLatency(target: string, durationMs: number): Promise<void> {
    if (!this.performanceMonitor) {
      return;
    }

    const report = this.performanceMonitor.record(target, durationMs);
    if (!report.critical) {
      return;
    }

    this.notify('performance-degradation', { target, report });

    if (
      this.moduleOptions.performance?.autoScaleOnDegradation &&
      this.moduleOptions.kubernetes?.hpa
    ) {
      await this.heal(target, new Error(`Performance degradation: p95=${report.p95Ms}ms`), {
        maxAttempts: 1,
        strategies: ['hpa-boost'],
      });
    }
  }

  private resolveAIDiagnostics(
    setting: SelfHealingModuleOptions['aiDiagnostics']
  ): AIDiagnosticsProvider | undefined {
    if (setting === true) {
      return resolveGlobalHazelAIDiagnosticsProvider();
    }
    if (typeof setting === 'object') {
      return setting;
    }
    return undefined;
  }

  private resolveNotifiers(
    notifications: SelfHealingModuleOptions['notifications']
  ): HealingNotifier[] {
    if (!notifications) {
      return [];
    }
    return Array.isArray(notifications) ? notifications : [notifications];
  }

  getConfigStore(): ConfigSnapshotStore {
    return this.configStore;
  }

  snapshotConfig(label: string, data: Record<string, unknown>): ConfigSnapshot {
    return this.configStore.snapshot(label, data);
  }

  async heal(
    target: string,
    error: unknown,
    methodOptions: SelfHealMethodOptions = {},
    instance?: Record<string, unknown>,
    args?: unknown[]
  ): Promise<HealingAttemptResult> {
    if (this.moduleOptions.enabled === false) {
      throw error;
    }

    const maxAttempts = methodOptions.maxAttempts ?? 3;
    const strategies = this.resolveStrategies(methodOptions);
    const diagnosis = await this.diagnostician.diagnose(error, { target, maxAttempts });

    const actions: HealingAttemptResult['actions'] = [];
    let recovered = false;
    const lastError: unknown = error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const context: HealingContext = {
        target,
        error: lastError,
        attempt,
        maxAttempts,
        instance,
        args,
        configStore: this.configStore,
        kubernetes: this.moduleOptions.kubernetes,
        drain: this.drainCoordinator,
        onNotify: (event, payload) => this.notify(event, payload),
      };

      const attemptStrategies = this.pickStrategiesForAttempt(
        strategies,
        diagnosis.suggestedStrategies,
        attempt
      );

      for (const strategyName of attemptStrategies) {
        const strategy = createStrategy(strategyName, methodOptions.fallback);
        const result = await strategy.execute(context);
        actions.push(result);

        if (result.success) {
          recovered = true;
          this.notify('critical-healing', {
            target,
            strategy: strategyName,
            attempt,
            diagnosis,
          });
          break;
        }
      }

      if (recovered) {
        break;
      }

      if (methodOptions.onError === 'safe-mode-only' && methodOptions.fallback) {
        const safeMode = createStrategy('safe-mode', methodOptions.fallback);
        const safeResult = await safeMode.execute(context);
        actions.push(safeResult);
        recovered = safeResult.success;
        break;
      }
    }

    if (!recovered) {
      this.notify('healing-failed', { target, diagnosis, actions });
    }

    return {
      target,
      diagnosis,
      actions,
      recovered,
      attempts: Math.min(maxAttempts, actions.length || 1),
    };
  }

  async executeWithHealing<T>(
    target: string,
    fn: () => Promise<T>,
    methodOptions: SelfHealMethodOptions = {},
    instance?: Record<string, unknown>,
    args?: unknown[]
  ): Promise<T> {
    const maxAttempts = methodOptions.maxAttempts ?? 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts && methodOptions.onError !== 'diagnose-and-fix') {
          throw error;
        }

        const result = await this.heal(target, error, methodOptions, instance, args);

        if (result.recovered) {
          if (methodOptions.onError === 'retry-only') {
            continue;
          }
          if (methodOptions.onError === 'diagnose-and-fix' || methodOptions.onError === undefined) {
            continue;
          }
        }

        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private resolveStrategies(methodOptions: SelfHealMethodOptions): HealingStrategyName[] {
    return methodOptions.strategies ?? this.moduleOptions.strategies ?? DEFAULT_STRATEGIES;
  }

  private pickStrategiesForAttempt(
    configured: HealingStrategyName[],
    suggested: HealingStrategyName[],
    attempt: number
  ): HealingStrategyName[] {
    const prioritized = suggested.filter((strategy) => configured.includes(strategy));
    const merged = [...new Set([...prioritized, ...configured])];

    if (attempt === 1) {
      return merged.slice(0, 2);
    }

    return merged;
  }

  private notify(event: HealingNotifyEvent, payload: Record<string, unknown>): void {
    const notifyOn = this.moduleOptions.notifyOn ?? [];
    if (notifyOn.includes(event)) {
      this.moduleOptions.onNotify?.(event, payload);
    }

    if (this.notifiers.length === 0) {
      return;
    }

    const chain = createHealingNotifierChain(this.notifiers);
    void chain.notify(event, payload);
  }
}

/**
 * Global registry — one coordinator per module scope.
 */
export class HealingRegistry {
  private static coordinators = new Map<string, HealingCoordinator>();

  static getOrCreate(scope: string, options?: SelfHealingModuleOptions): HealingCoordinator {
    const existing = this.coordinators.get(scope);
    if (existing) {
      return existing;
    }

    const coordinator = new HealingCoordinator(options);
    this.coordinators.set(scope, coordinator);
    return coordinator;
  }

  static get(scope: string): HealingCoordinator | undefined {
    return this.coordinators.get(scope);
  }

  static reset(): void {
    this.coordinators.clear();
  }
}

export function createHealingCoordinator(options?: SelfHealingModuleOptions): HealingCoordinator {
  return new HealingCoordinator(options);
}

export type { AIDiagnosticsProvider };
