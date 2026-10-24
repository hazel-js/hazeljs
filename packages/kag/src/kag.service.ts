import { Service } from '@hazeljs/core';
import type {
  AskOptions,
  ContextContribution,
  ContextContributor,
  KagModuleOptions,
  KnowledgeAnswer,
  EntityResolutionResult,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgeRelation,
  ObservationPromotion,
  TraversalResult,
} from './types';
import { KnowledgeGraph } from './knowledge-graph';
import { KagError } from './errors/kag.error';
import { ingestKnowledge, type IngestBatch, type IngestResult } from './ingestion/ingest';
import { importGraph, type GraphStoreLike } from './adapters/graphrag.adapter';

@Service()
export class KagService implements ContextContributor {
  readonly kind = 'kag' as const;
  private readonly graphs = new Map<string, KnowledgeGraph>();
  private readonly options: KagModuleOptions;

  constructor(options: KagModuleOptions = {}) {
    this.options = options;
    if (options.tenantId) {
      this.graphs.set(
        this.key(options.tenantId, options.graph),
        new KnowledgeGraph({
          ...options,
          tenantId: options.tenantId,
        })
      );
    }
  }

  forTenant(tenantId: string, graph?: string): KnowledgeGraph {
    const k = this.key(tenantId, graph ?? this.options.graph);
    let g = this.graphs.get(k);
    if (!g) {
      g = new KnowledgeGraph({
        ...this.options,
        tenantId,
        graph: graph ?? this.options.graph,
      });
      this.graphs.set(k, g);
    }
    return g;
  }

  private graphOrThrow(tenantId?: string, graph?: string): KnowledgeGraph {
    const tid = tenantId ?? this.options.tenantId;
    if (!tid) {
      throw KagError.tenantRequired();
    }
    return this.forTenant(tid, graph);
  }

  async entity(
    input: KnowledgeEntity,
    opts?: { tenantId?: string; graph?: string }
  ): Promise<KnowledgeEntity> {
    return this.graphOrThrow(opts?.tenantId, opts?.graph).entity(input);
  }

  async relate(
    input: Omit<KnowledgeRelation, 'id'> & { id?: string },
    opts?: { tenantId?: string; graph?: string }
  ): Promise<KnowledgeRelation> {
    return this.graphOrThrow(opts?.tenantId, opts?.graph).relate(input);
  }

  async fact(
    input: KnowledgeFact,
    opts?: { tenantId?: string; graph?: string }
  ): Promise<{ fact: KnowledgeFact; contradictions: KnowledgeFact[] }> {
    return this.graphOrThrow(opts?.tenantId, opts?.graph).fact(input);
  }

  async ingest(
    batch: IngestBatch,
    opts?: { tenantId?: string; graph?: string; raw?: unknown }
  ): Promise<IngestResult> {
    const g = this.graphOrThrow(opts?.tenantId, opts?.graph);
    return ingestKnowledge(g, batch, {
      extractor: this.options.extractor,
      raw: opts?.raw,
    });
  }

  async traverse(
    seedIds: string[],
    options?: { depth?: number; asOf?: Date | string; tenantId?: string; graph?: string }
  ): Promise<TraversalResult> {
    return this.graphOrThrow(options?.tenantId, options?.graph).traverse(seedIds, options);
  }

  async ask(
    question: string,
    options: AskOptions & { tenantId?: string } = {}
  ): Promise<KnowledgeAnswer> {
    return this.graphOrThrow(options.tenantId, options.graph).ask(question, options);
  }

  async resolve(
    candidate: KnowledgeEntity,
    opts?: { tenantId?: string; graph?: string }
  ): Promise<EntityResolutionResult> {
    return this.graphOrThrow(opts?.tenantId, opts?.graph).resolve(candidate);
  }

  async promoteObservation(
    observation: ObservationPromotion,
    opts?: { tenantId?: string; graph?: string }
  ): Promise<KnowledgeFact | null> {
    return this.graphOrThrow(opts?.tenantId, opts?.graph).promoteObservation(observation);
  }

  async importGraphRag(
    graphStore: GraphStoreLike,
    opts?: { tenantId?: string; graph?: string }
  ): Promise<{ entities: number; relations: number }> {
    return importGraph(this.graphOrThrow(opts?.tenantId, opts?.graph), graphStore);
  }

  async contribute(request: {
    query: string;
    tenantId: string;
    namespace?: string;
    agentId?: string;
  }): Promise<ContextContribution> {
    return this.forTenant(request.tenantId, request.namespace).contribute(request);
  }

  private key(tenantId: string, graph?: string): string {
    return `${tenantId}::${graph ?? 'default'}`;
  }
}
