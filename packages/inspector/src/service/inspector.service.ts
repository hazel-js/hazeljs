/**
 * HazelInspectorService - Aggregates inspector plugin results with caching
 */

import type {
  InspectorContext,
  InspectorEntry,
  InspectorSnapshot,
  InspectorEntryKind,
  RouteInspectorEntry,
  ModuleInspectorEntry,
  ProviderInspectorEntry,
  DecoratorInspectorEntry,
  CronInspectorEntry,
  QueueInspectorEntry,
  WebSocketInspectorEntry,
  AgentInspectorEntry,
  RagInspectorEntry,
  PromptInspectorEntry,
  AIFunctionInspectorEntry,
  EventInspectorEntry,
  GraphQLInspectorEntry,
  GrpcInspectorEntry,
  KafkaInspectorEntry,
  FlowInspectorEntry,
  DataPipelineInspectorEntry,
  ServerlessInspectorEntry,
  MLModelInspectorEntry,
  WorkerInspectorEntry,
  GroupedSnapshot,
} from '../contracts/types';
import type { HazelInspectorRegistry } from '../registry/registry';
import { mergeInspectorConfig } from '../config/inspector.config';
import type { InspectorModuleOptions } from '../contracts/types';

export class HazelInspectorService {
  private cache: InspectorSnapshot | null = null;
  private cacheTime = 0;

  constructor(
    private registry: HazelInspectorRegistry,
    private config: Required<InspectorModuleOptions>
  ) {
    this.config = mergeInspectorConfig(config);
  }

  async collectSnapshot(context: InspectorContext): Promise<InspectorSnapshot> {
    const now = Date.now();
    const maxAge = this.config.maxSnapshotCacheAgeMs ?? 5000;
    if (this.cache && now - this.cacheTime < maxAge) {
      return this.cache;
    }

    const rawEntries = await this.registry.runAll(context);
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const summary: Partial<Record<InspectorEntryKind, number>> = {};
    for (const e of entries) {
      summary[e.kind] = (summary[e.kind] ?? 0) + 1;
    }

    this.cache = {
      collectedAt: new Date().toISOString(),
      entries,
      summary,
    };
    this.cacheTime = now;
    return this.cache;
  }

  async refresh(context: InspectorContext): Promise<InspectorSnapshot> {
    this.cache = null;
    return this.collectSnapshot(context);
  }

  getRoutes(entries: InspectorEntry[]): RouteInspectorEntry[] {
    return entries.filter((e): e is RouteInspectorEntry => e.kind === 'route');
  }

  getModules(entries: InspectorEntry[]): ModuleInspectorEntry[] {
    return entries.filter((e): e is ModuleInspectorEntry => e.kind === 'module');
  }

  getProviders(entries: InspectorEntry[]): ProviderInspectorEntry[] {
    return entries.filter((e): e is ProviderInspectorEntry => e.kind === 'provider');
  }

  getDecorators(entries: InspectorEntry[]): DecoratorInspectorEntry[] {
    return entries.filter((e): e is DecoratorInspectorEntry => e.kind === 'decorator');
  }

  getJobs(entries: InspectorEntry[]): CronInspectorEntry[] {
    return entries.filter((e): e is CronInspectorEntry => e.kind === 'cron');
  }

  getQueues(entries: InspectorEntry[]): QueueInspectorEntry[] {
    return entries.filter((e): e is QueueInspectorEntry => e.kind === 'queue');
  }

  getWebSockets(entries: InspectorEntry[]): WebSocketInspectorEntry[] {
    return entries.filter((e): e is WebSocketInspectorEntry => e.kind === 'websocket');
  }

  getAgents(entries: InspectorEntry[]): AgentInspectorEntry[] {
    return entries.filter((e): e is AgentInspectorEntry => e.kind === 'agent');
  }

  getRag(entries: InspectorEntry[]): RagInspectorEntry[] {
    return entries.filter((e): e is RagInspectorEntry => e.kind === 'rag');
  }

  getPrompts(entries: InspectorEntry[]): PromptInspectorEntry[] {
    return entries.filter((e): e is PromptInspectorEntry => e.kind === 'prompt');
  }

  getAIFunctions(entries: InspectorEntry[]): AIFunctionInspectorEntry[] {
    return entries.filter((e): e is AIFunctionInspectorEntry => e.kind === 'aifunction');
  }

  getEvents(entries: InspectorEntry[]): EventInspectorEntry[] {
    return entries.filter((e): e is EventInspectorEntry => e.kind === 'event');
  }

  getGraphQL(entries: InspectorEntry[]): GraphQLInspectorEntry[] {
    return entries.filter((e): e is GraphQLInspectorEntry => e.kind === 'graphql');
  }

  getGrpc(entries: InspectorEntry[]): GrpcInspectorEntry[] {
    return entries.filter((e): e is GrpcInspectorEntry => e.kind === 'grpc');
  }

  getKafka(entries: InspectorEntry[]): KafkaInspectorEntry[] {
    return entries.filter((e): e is KafkaInspectorEntry => e.kind === 'kafka');
  }

  getFlows(entries: InspectorEntry[]): FlowInspectorEntry[] {
    return entries.filter((e): e is FlowInspectorEntry => e.kind === 'flow');
  }

  getDataPipelines(entries: InspectorEntry[]): DataPipelineInspectorEntry[] {
    return entries.filter((e): e is DataPipelineInspectorEntry => e.kind === 'data');
  }

  getServerless(entries: InspectorEntry[]): ServerlessInspectorEntry[] {
    return entries.filter((e): e is ServerlessInspectorEntry => e.kind === 'serverless');
  }

  getMLModels(entries: InspectorEntry[]): MLModelInspectorEntry[] {
    return entries.filter((e): e is MLModelInspectorEntry => e.kind === 'ml');
  }

  getWorkers(entries: InspectorEntry[]): WorkerInspectorEntry[] {
    return entries.filter((e): e is WorkerInspectorEntry => e.kind === 'worker');
  }

  getByKind(entries: InspectorEntry[], kind: InspectorEntryKind): InspectorEntry[] {
    return entries.filter((e) => e.kind === kind);
  }

  getGroupedSnapshot(entries: InspectorEntry[]): GroupedSnapshot {
    const knownKinds = [
      'route',
      'decorator',
      'module',
      'provider',
      'websocket',
      'cron',
      'queue',
      'agent',
      'rag',
      'prompt',
      'aifunction',
      'event',
      'graphql',
      'grpc',
      'kafka',
      'flow',
      'data',
      'serverless',
      'ml',
      'worker',
    ];
    return {
      routes: this.getRoutes(entries),
      decorators: this.getDecorators(entries),
      modules: this.getModules(entries),
      providers: this.getProviders(entries),
      websockets: this.getWebSockets(entries),
      jobs: this.getJobs(entries),
      queues: this.getQueues(entries),
      agents: this.getAgents(entries),
      rag: this.getRag(entries),
      prompts: this.getPrompts(entries),
      aifunctions: this.getAIFunctions(entries),
      events: this.getEvents(entries),
      graphql: this.getGraphQL(entries),
      grpc: this.getGrpc(entries),
      kafka: this.getKafka(entries),
      flows: this.getFlows(entries),
      dataPipelines: this.getDataPipelines(entries),
      serverless: this.getServerless(entries),
      mlModels: this.getMLModels(entries),
      workers: this.getWorkers(entries),
      other: entries.filter((e) => !knownKinds.includes(e.kind)),
    };
  }
}
