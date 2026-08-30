/**
 * Self-healing types for @hazeljs/self-healing
 */

export type HealingStrategyName =
  | 'auto-restart'
  | 'config-rollback'
  | 'memory-cleanup'
  | 'safe-mode'
  | 'pod-restart'
  | 'hpa-boost';

export type HealingNotifyEvent =
  | 'critical-healing'
  | 'auto-rollback'
  | 'memory-threshold'
  | 'performance-degradation'
  | 'safe-mode-activated'
  | 'healing-failed'
  | 'pod-restart'
  | 'hpa-boost'
  | 'graceful-drain';

export type ErrorCategory =
  | 'dependency'
  | 'config'
  | 'memory'
  | 'timeout'
  | 'performance'
  | 'unknown';

export type SelfHealOnError = 'diagnose-and-fix' | 'retry-only' | 'safe-mode-only';

export type MemoryGuardAction = 'graceful-restart' | 'memory-cleanup' | 'notify-only';

export interface DiagnosisResult {
  category: ErrorCategory;
  confidence: number;
  message: string;
  suggestedStrategies: HealingStrategyName[];
  metadata?: Record<string, unknown>;
}

export interface HealingActionResult {
  strategy: HealingStrategyName;
  success: boolean;
  message: string;
  rolledBack?: boolean;
}

export interface HealingAttemptResult {
  target: string;
  diagnosis: DiagnosisResult;
  actions: HealingActionResult[];
  recovered: boolean;
  attempts: number;
}

export interface SelfHealingModuleOptions {
  enabled?: boolean;
  strategies?: HealingStrategyName[];
  aiDiagnostics?: boolean | AIDiagnosticsProvider;
  notifyOn?: HealingNotifyEvent[];
  onNotify?: (event: HealingNotifyEvent, payload: Record<string, unknown>) => void;
  notifications?: HealingNotifier | HealingNotifier[];
  kubernetes?: KubernetesHealingConfig;
  drain?: DrainOptions | boolean;
  performance?: PerformanceHealingConfig;
}

export interface PerformanceHealingConfig {
  enabled?: boolean;
  thresholds?: PerformanceThresholds;
  /** Auto-trigger hpa-boost when latency is critical */
  autoScaleOnDegradation?: boolean;
}

export interface DrainCoordinatorLike {
  drain(options?: DrainOptions): Promise<{ drained: boolean; waitedMs: number }>;
  isDraining(): boolean;
  isReady(): boolean;
}

export interface DrainOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  onDrainStart?: () => void | Promise<void>;
  onReadyChange?: (ready: boolean) => void | Promise<void>;
  getInflightCount?: () => number;
}

export interface KubernetesHealingConfig {
  deployment: string;
  namespace?: string;
  client?: KubernetesRestartClient;
  /** Drain in-flight work before pod restart (default: true when client is set) */
  drainBeforeRestart?: boolean | DrainOptions;
  hpa?: KubernetesHpaConfig;
}

export interface KubernetesHpaConfig {
  name: string;
  namespace?: string;
  client?: KubernetesScalingClient;
  /** Temporary minimum replicas during boost */
  boostMinReplicas?: number;
  /** Restore original min replicas after this delay (ms) */
  restoreAfterMs?: number;
}

export interface KubernetesScalingClient {
  getHpaMinReplicas(hpa: string, namespace: string): Promise<number>;
  setHpaMinReplicas(hpa: string, namespace: string, minReplicas: number): Promise<void>;
}

export interface KubernetesRestartClient {
  rolloutRestart(deployment: string, namespace: string): Promise<void>;
}

export interface HealingNotifier {
  notify(event: HealingNotifyEvent, payload: Record<string, unknown>): Promise<void>;
}

export interface SelfHealMethodOptions {
  onError?: SelfHealOnError;
  maxAttempts?: number;
  fallback?: string;
  strategies?: HealingStrategyName[];
  name?: string;
}

export interface MemoryGuardOptions {
  threshold?: number | string;
  intervalMs?: number;
  action?: MemoryGuardAction;
  preserveState?: boolean;
  onThresholdExceeded?: (usage: MemoryUsageSnapshot) => void | Promise<void>;
  drain?: DrainOptions | boolean;
}

export interface MemoryUsageSnapshot {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  timestamp: number;
}

export interface ConfigSnapshot {
  id: string;
  label: string;
  data: Record<string, unknown>;
  createdAt: number;
}

export interface PerformanceThresholds {
  warnLatencyMs?: number;
  criticalLatencyMs?: number;
  sampleSize?: number;
}

export interface AIDiagnosticsProvider {
  diagnose(error: unknown, context: Record<string, unknown>): Promise<DiagnosisResult | null>;
}

export interface HealingContext {
  target: string;
  error: unknown;
  attempt: number;
  maxAttempts: number;
  instance?: Record<string, unknown>;
  args?: unknown[];
  configStore?: ConfigSnapshotStoreLike;
  kubernetes?: KubernetesHealingConfig;
  drain?: DrainCoordinatorLike;
  onNotify?: (event: HealingNotifyEvent, payload: Record<string, unknown>) => void;
}

export interface ConfigSnapshotStoreLike {
  snapshot(label: string, data: Record<string, unknown>): ConfigSnapshot;
  rollback(snapshotId?: string): ConfigSnapshot | null;
  getLatest(): ConfigSnapshot | null;
  list(): ConfigSnapshot[];
}

export class SelfHealingError extends Error {
  constructor(
    message: string,
    public readonly target: string,
    public readonly diagnosis?: DiagnosisResult
  ) {
    super(message);
    this.name = 'SelfHealingError';
  }
}
