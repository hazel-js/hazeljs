/**
 * Normalized inspector data contract for HazelJS framework metadata
 */

import type { Type, Container, Router } from '@hazeljs/core';

/** All supported inspector entry kinds */
export type InspectorEntryKind =
  | 'route'
  | 'decorator'
  | 'module'
  | 'provider'
  | 'websocket'
  | 'cron'
  | 'queue'
  | 'agent'
  | 'rag'
  | 'prompt'
  | 'aifunction'
  | 'policy'
  | 'param'
  | 'graphql'
  | 'grpc'
  | 'kafka'
  | 'event'
  | 'flow'
  | 'data'
  | 'serverless'
  | 'ml'
  | 'worker';

/** Base fields shared by all inspector entries */
export interface InspectorEntryBase {
  id: string;
  kind: InspectorEntryKind;
  packageName: string;
  sourceType?: 'class' | 'method' | 'parameter' | 'property';
  className?: string;
  methodName?: string;
  filePath?: string;
  decorators?: string[];
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/** Route-specific inspector entry */
export interface RouteInspectorEntry extends InspectorEntryBase {
  kind: 'route';
  httpMethod: string;
  fullPath: string;
  controllerPath: string;
  routePath: string;
  version?: string;
  guards?: string[];
  interceptors?: string[];
  pipes?: string[];
  middleware?: string[];
  params?: ParamInspectorEntry[];
  responseMetadata?: Record<string, unknown>;
  authMetadata?: Record<string, unknown>;
}

/** Parameter inspector entry */
export interface ParamInspectorEntry {
  index: number;
  paramKey?: string;
  decoratorName: string;
  pipe?: string;
}

/** Decorator-specific inspector entry */
export interface DecoratorInspectorEntry extends InspectorEntryBase {
  kind: 'decorator';
  decoratorName: string;
  targetType: 'class' | 'method' | 'parameter' | 'property';
  targetClass?: string;
  targetMethod?: string;
  decoratorArguments?: unknown[];
  rawMetadataKey?: string;
}

/** Module-specific inspector entry */
export interface ModuleInspectorEntry extends InspectorEntryBase {
  kind: 'module';
  moduleName: string;
  imports?: string[];
  providers?: string[];
  controllers?: string[];
  exports?: string[];
  dynamicModule?: boolean;
}

/** Provider-specific inspector entry */
export interface ProviderInspectorEntry extends InspectorEntryBase {
  kind: 'provider';
  providerName: string;
  token: string;
  scope?: 'singleton' | 'transient' | 'request';
  dependencies?: string[];
  exportedFrom?: string;
  moduleName?: string;
}

/** WebSocket-specific inspector entry */
export interface WebSocketInspectorEntry extends InspectorEntryBase {
  kind: 'websocket';
  gatewayName: string;
  namespace?: string;
  eventName?: string;
  rooms?: string[];
  guards?: string[];
  interceptors?: string[];
  payloadMetadata?: Record<string, unknown>;
}

/** Cron job inspector entry */
export interface CronInspectorEntry extends InspectorEntryBase {
  kind: 'cron';
  jobName: string;
  cronExpression?: string;
  nextRuns?: string[];
  interval?: number;
  timeout?: number;
  nextRun?: string;
  enabled?: boolean;
  retryPolicy?: Record<string, unknown>;
}

/** Queue processor inspector entry */
export interface QueueInspectorEntry extends InspectorEntryBase {
  kind: 'queue';
  queueName: string;
  consumerName: string;
  jobName?: string;
  concurrency?: number;
  retry?: Record<string, unknown>;
}

/** Worker task inspector entry */
export interface WorkerInspectorEntry extends InspectorEntryBase {
  kind: 'worker';
  taskName: string;
  handlerPath?: string;
  timeout?: number;
  maxConcurrency?: number;
}

/** Agent inspector entry */
export interface AgentInspectorEntry extends InspectorEntryBase {
  kind: 'agent';
  agentName: string;
  tools?: string[];
  memoryProvider?: string;
  model?: string;
  guardrails?: string[];
  promptIds?: string[];
}

/** RAG pipeline inspector entry */
export interface RagInspectorEntry extends InspectorEntryBase {
  kind: 'rag';
  pipelineName: string;
  retrieverType?: string;
  embeddingProvider?: string;
  vectorStore?: string;
  dataSources?: string[];
  chunkingStrategy?: string;
}

/** Prompt template inspector entry */
export interface PromptInspectorEntry extends InspectorEntryBase {
  kind: 'prompt';
  promptKey: string;
  scope?: string;
}

/** AI function inspector entry */
export interface AIFunctionInspectorEntry extends InspectorEntryBase {
  kind: 'aifunction';
  provider?: string;
  model?: string;
  streaming?: boolean;
}

/** Event listener inspector entry */
export interface EventInspectorEntry extends InspectorEntryBase {
  kind: 'event';
  eventName: string;
}

/** GraphQL inspector entry */
export interface GraphQLInspectorEntry extends InspectorEntryBase {
  kind: 'graphql';
  resolverName?: string;
  operationType: 'query' | 'mutation';
  operationName: string;
}

/** gRPC inspector entry */
export interface GrpcInspectorEntry extends InspectorEntryBase {
  kind: 'grpc';
  serviceName: string;
  methodName: string;
}

/** Kafka inspector entry */
export interface KafkaInspectorEntry extends InspectorEntryBase {
  kind: 'kafka';
  consumerName: string;
  groupId?: string;
  topic: string;
}

/** Flow inspector entry */
export interface FlowInspectorEntry extends InspectorEntryBase {
  kind: 'flow';
  flowId: string;
  version?: string;
  nodeName?: string;
  /** Entry node id (for flow definitions) */
  entryNode?: string;
  /** Comma-separated node ids (for flow definitions) */
  nodes?: string;
  /** Edge definitions e.g. "start→validate; validate→process" */
  edges?: string;
}

/** Data pipeline inspector entry */
export interface DataPipelineInspectorEntry extends InspectorEntryBase {
  kind: 'data';
  pipelineName: string;
}

/** Serverless inspector entry */
export interface ServerlessInspectorEntry extends InspectorEntryBase {
  kind: 'serverless';
  controllerName: string;
  runtime?: string;
  memory?: number;
  timeout?: number;
}

/** ML model inspector entry */
export interface MLModelInspectorEntry extends InspectorEntryBase {
  kind: 'ml';
  modelName: string;
  version?: string;
}

/** Union of all inspector entry types */
export type InspectorEntry =
  | RouteInspectorEntry
  | DecoratorInspectorEntry
  | ModuleInspectorEntry
  | ProviderInspectorEntry
  | WebSocketInspectorEntry
  | CronInspectorEntry
  | QueueInspectorEntry
  | AgentInspectorEntry
  | RagInspectorEntry
  | PromptInspectorEntry
  | AIFunctionInspectorEntry
  | EventInspectorEntry
  | GraphQLInspectorEntry
  | GrpcInspectorEntry
  | KafkaInspectorEntry
  | FlowInspectorEntry
  | DataPipelineInspectorEntry
  | ServerlessInspectorEntry
  | MLModelInspectorEntry
  | WorkerInspectorEntry
  | (InspectorEntryBase & {
      kind: Exclude<
        InspectorEntryKind,
        | 'route'
        | 'decorator'
        | 'module'
        | 'provider'
        | 'websocket'
        | 'cron'
        | 'queue'
        | 'agent'
        | 'rag'
        | 'prompt'
        | 'aifunction'
        | 'event'
        | 'graphql'
        | 'grpc'
        | 'kafka'
        | 'flow'
        | 'data'
        | 'serverless'
        | 'ml'
        | 'worker'
      >;
    });

/** Full inspector snapshot */
export interface InspectorSnapshot {
  collectedAt: string;
  entries: InspectorEntry[];
  summary: Partial<Record<InspectorEntryKind, number>>;
}

/** Grouped snapshot for UI consumption */
export interface GroupedSnapshot {
  routes: RouteInspectorEntry[];
  decorators: DecoratorInspectorEntry[];
  modules: ModuleInspectorEntry[];
  providers: ProviderInspectorEntry[];
  websockets: WebSocketInspectorEntry[];
  jobs: CronInspectorEntry[];
  queues: QueueInspectorEntry[];
  agents: AgentInspectorEntry[];
  rag: RagInspectorEntry[];
  prompts: PromptInspectorEntry[];
  aifunctions: AIFunctionInspectorEntry[];
  events: EventInspectorEntry[];
  graphql: GraphQLInspectorEntry[];
  grpc: GrpcInspectorEntry[];
  kafka: KafkaInspectorEntry[];
  flows: FlowInspectorEntry[];
  dataPipelines: DataPipelineInspectorEntry[];
  serverless: ServerlessInspectorEntry[];
  mlModels: MLModelInspectorEntry[];
  workers: WorkerInspectorEntry[];
  other: InspectorEntry[];
}

/** Context passed to inspector plugins */
export interface InspectorContext {
  moduleType: Type<unknown>;
  container: Container;
  router: Router;
}

/** Plugin interface for inspector extensions */
export interface HazelInspectorPlugin {
  name: string;
  version?: string;
  supports(context: InspectorContext): boolean;
  inspect(context: InspectorContext): Promise<InspectorEntry[]>;
}

/** Inspector module configuration */
export interface InspectorModuleOptions {
  enableInspector?: boolean;
  inspectorBasePath?: string;
  exposeUi?: boolean;
  exposeJson?: boolean;
  developmentOnly?: boolean;
  requireAuth?: boolean;
  enabledInspectors?: string[];
  hiddenMetadataKeys?: string[];
  maxSnapshotCacheAgeMs?: number;
}
