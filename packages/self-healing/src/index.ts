/**
 * @hazeljs/self-healing
 * Self-healing microservices for HazelJS
 */

// Types
export {
  HealingStrategyName,
  HealingNotifyEvent,
  ErrorCategory,
  SelfHealOnError,
  MemoryGuardAction,
  DiagnosisResult,
  HealingActionResult,
  HealingAttemptResult,
  SelfHealingModuleOptions,
  SelfHealMethodOptions,
  MemoryGuardOptions,
  MemoryUsageSnapshot,
  ConfigSnapshot,
  PerformanceThresholds,
  PerformanceHealingConfig,
  AIDiagnosticsProvider,
  HealingContext,
  ConfigSnapshotStoreLike,
  SelfHealingError,
  KubernetesHealingConfig,
  KubernetesHpaConfig,
  KubernetesRestartClient,
  KubernetesScalingClient,
  HealingNotifier,
  DrainOptions,
  DrainCoordinatorLike,
} from './types';

// Diagnosis
export { ErrorDiagnostician } from './diagnosis/error-diagnostician';
export {
  createAIDiagnosticsProvider,
  parseDiagnosisJson,
  AILlmClient,
} from './diagnosis/ai-diagnostics-provider';

// Integrations
export {
  createHazelAIDiagnosticsProvider,
  resolveGlobalHazelAIDiagnosticsProvider,
  HazelAICompletionClient,
} from './integrations/hazel-ai';
export {
  createJiraHealingNotifier,
  JiraHealingNotifierConfig,
  JiraToolLike,
} from './integrations/ops-agent';

// Drain
export {
  GracefulDrainCoordinator,
  createGracefulDrainCoordinator,
  drainBeforeAction,
} from './drain/graceful-drain';

// Config
export { ConfigSnapshotStore } from './config/config-snapshot-store';

// Kubernetes
export {
  FetchKubernetesRestartClient,
  InMemoryKubernetesRestartClient,
  KubernetesRestartClientOptions,
} from './kubernetes/kubernetes-restart-client';
export {
  FetchKubernetesScalingClient,
  InMemoryKubernetesScalingClient,
  KubernetesScalingClientOptions,
} from './kubernetes/kubernetes-scaling-client';

// Notifications
export {
  createSlackHealingNotifier,
  createPagerDutyHealingNotifier,
  createHealingNotifierChain,
  SlackHealingNotifierConfig,
  PagerDutyHealingNotifierConfig,
} from './notifications/healing-notifiers';

// Healing
export {
  HealingCoordinator,
  HealingRegistry,
  createHealingCoordinator,
} from './healing/healing-coordinator';
export {
  AutoRestartStrategy,
  ConfigRollbackStrategy,
  MemoryCleanupStrategy,
  SafeModeStrategy,
  PodRestartStrategy,
  HpaBoostStrategy,
  createStrategy,
  HealingStrategy,
} from './healing/strategies';

// Memory
export { MemoryGuardMonitor, MemoryGuardEvent } from './memory/memory-guard';
export { parseMemoryThreshold, getMemoryUsage, formatBytes } from './utils/memory';

// Performance
export {
  PerformanceMonitor,
  PerformanceMonitorRegistry,
  PerformanceReport,
  LatencySample,
} from './performance/performance-monitor';

// Decorators
export {
  SelfHealing,
  SelfHeal,
  MemoryGuard,
  getSelfHealingModuleOptions,
  getMemoryGuardMonitor,
} from './decorators';
