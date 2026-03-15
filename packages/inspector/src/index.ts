/**
 * @hazeljs/inspector - Framework-aware runtime inspector for HazelJS
 */

export { InspectorModule } from './inspector.module';
export { InspectorRuntime } from './runtime/inspector-runtime';
export type {
  GatewayOverview,
  DiscoveryOverview,
  ResilienceOverview,
} from './runtime/inspector-runtime';
export { HazelInspectorRegistry, type HazelInspectorPlugin } from './registry/registry';
export { HazelInspectorService } from './service/inspector.service';
export type {
  InspectorEntry,
  InspectorSnapshot,
  InspectorEntryKind,
  InspectorContext,
  InspectorModuleOptions,
} from './contracts/types';
export type {
  RouteInspectorEntry,
  ModuleInspectorEntry,
  ProviderInspectorEntry,
  DecoratorInspectorEntry,
  CronInspectorEntry,
  QueueInspectorEntry,
  WebSocketInspectorEntry,
  AgentInspectorEntry,
  RagInspectorEntry,
} from './contracts/types';
