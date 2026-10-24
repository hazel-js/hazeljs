import EventEmitter from 'eventemitter3';
import { randomUUID } from 'crypto';
import type {
  AskOptions,
  ContextContribution,
  ContextContributor,
  EntityResolutionResult,
  KagModuleOptions,
  KnowledgeAnswer,
  KnowledgeAuthorizer,
  KnowledgeEntity,
  KnowledgeEvidence,
  KnowledgeFact,
  KnowledgeQueryPlanner,
  KnowledgeRelation,
  KnowledgeRetriever,
  KnowledgeScope,
  KnowledgeSource,
  KnowledgeStore,
  ObservationPromotion,
  TraversalResult,
} from './types';
import { KAG_EVENTS } from './types';
import { InMemoryKnowledgeStore } from './stores/in-memory-knowledge.store';
import { EntityResolver } from './resolution/entity-resolver';
import { HeuristicQueryPlanner } from './planner/heuristic-query-planner';
import { TenantKnowledgeAuthorizer, assertAuthorized } from './security/authorizer';
import { KagError } from './errors/kag.error';
import { rankFacts, aggregateConfidence } from './confidence';
import { changesBetween, isFactValidAt } from './temporal';

export interface KnowledgeGraphOptions extends KagModuleOptions {
  store?: KnowledgeStore;
  tenantId: string;
  graph?: string;
}

/**
 * Primary KAG facade for scripts and tests (similar to GraphRAGPipeline).
 */
export class KnowledgeGraph implements ContextContributor {
  readonly kind = 'kag' as const;

  private readonly store: KnowledgeStore;
  private readonly scope: KnowledgeScope;
  private readonly resolver: EntityResolver;
  private readonly planner: KnowledgeQueryPlanner;
  private readonly authorizer: KnowledgeAuthorizer;
  private readonly retriever?: KnowledgeRetriever;
  private readonly llm?: KagModuleOptions['llm'];
  private readonly confidenceAggregation: NonNullable<KagModuleOptions['confidenceAggregation']>;
  private readonly externalEmitter?: KagModuleOptions['eventEmitter'];
  private readonly localEmitter = new EventEmitter();

  constructor(options: KnowledgeGraphOptions) {
    if (!options.tenantId) {
      throw KagError.tenantRequired();
    }
    this.store = options.store ?? new InMemoryKnowledgeStore(options.contradictionPolicy ?? 'rank');
    this.scope = { tenantId: options.tenantId, graph: options.graph };
    this.resolver = new EntityResolver({
      mergeThreshold: options.mergeThreshold ?? 0.9,
      embed: options.embed,
      strategies: options.embed ? ['exact', 'normalized', 'semantic'] : ['exact', 'normalized'],
    });
    this.planner =
      options.planner ??
      new HeuristicQueryPlanner({
        industry: options.industry,
      });
    this.authorizer = options.authorizer ?? new TenantKnowledgeAuthorizer(options.tenantId);
    this.retriever = options.retriever;
    this.llm = options.llm;
    this.confidenceAggregation = options.confidenceAggregation ?? 'min';
    this.externalEmitter = options.eventEmitter;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    this.localEmitter.on(event, listener);
    return this;
  }

  getScope(): KnowledgeScope {
    return { ...this.scope };
  }

  async entity(input: KnowledgeEntity): Promise<KnowledgeEntity> {
    await assertAuthorized(this.authorizer, this.scope, 'write', {
      kind: 'entity',
      id: input.id,
      type: input.type,
    });

    const existing = await this.store.listEntities(this.scope);
    const resolution = await this.resolver.resolve(input, existing);
    const toWrite = resolution.merged
      ? { ...resolution.merged, id: resolution.merged.id }
      : { ...input, confidence: input.confidence ?? 1 };

    const prior = await this.store.getEntity(this.scope, toWrite.id);
    await this.store.upsertEntity(this.scope, toWrite);
    this.emit(prior ? KAG_EVENTS.ENTITY_UPDATED : KAG_EVENTS.ENTITY_CREATED, toWrite);
    return toWrite;
  }

  async relate(input: Omit<KnowledgeRelation, 'id'> & { id?: string }): Promise<KnowledgeRelation> {
    await assertAuthorized(this.authorizer, this.scope, 'write', {
      kind: 'relation',
      type: input.type,
    });
    const relation: KnowledgeRelation = {
      ...input,
      id: input.id ?? `${input.from}:${input.type}:${input.to}`,
      confidence: input.confidence ?? 1,
    };
    await this.store.upsertRelation(this.scope, relation);
    this.emit(KAG_EVENTS.RELATION_CREATED, relation);
    return relation;
  }

  async fact(
    input: KnowledgeFact
  ): Promise<{ fact: KnowledgeFact; contradictions: KnowledgeFact[] }> {
    await assertAuthorized(this.authorizer, this.scope, 'write', {
      kind: 'fact',
      id: input.subject,
    });
    const { contradictions } = await this.store.upsertFact(this.scope, input);
    if (contradictions.length > 0) {
      this.emit(KAG_EVENTS.CONTRADICTION_DETECTED, { fact: input, contradictions });
    }
    this.emit(KAG_EVENTS.FACT_ADDED, input);
    return { fact: input, contradictions };
  }

  async resolve(candidate: KnowledgeEntity): Promise<EntityResolutionResult> {
    const existing = await this.store.listEntities(this.scope);
    return this.resolver.resolve(candidate, existing);
  }

  async traverse(
    seedIds: string[],
    options?: { depth?: number; asOf?: Date | string }
  ): Promise<TraversalResult> {
    await assertAuthorized(this.authorizer, this.scope, 'read', { kind: 'entity' });
    return this.store.traverse(this.scope, seedIds, options);
  }

  async ask(question: string, options: AskOptions = {}): Promise<KnowledgeAnswer> {
    await assertAuthorized(this.authorizer, this.scope, 'read', { kind: 'entity' });

    const entities = await this.store.listEntities(this.scope);
    const plan = await this.planner.plan(question, { scope: this.scope, entities });
    const seeds = plan.seedIds.length > 0 ? plan.seedIds : entities.slice(0, 5).map((e) => e.id);

    const traversal = await this.store.traverse(this.scope, seeds, {
      depth: options.depth ?? plan.depth,
      relationTypes: plan.relationTypes,
      asOf: options.asOf,
    });

    const evidence: KnowledgeEvidence[] = [];
    for (const rel of traversal.relations) {
      evidence.push({
        entity: rel.from,
        relation: rel.type,
        entity2: rel.to,
        source: rel.source,
      });
    }
    for (const f of traversal.facts) {
      evidence.push({ fact: f, source: f.source, entity: f.subject });
    }

    let alternatives: KnowledgeFact[] | undefined;
    const subjectIds = [
      ...new Set([
        ...seeds,
        ...traversal.entities.map((e) => e.id),
        ...traversal.facts.map((f) => f.subject),
      ]),
    ];
    const query = await this.store.query(this.scope, {
      entityIds: subjectIds.length > 0 ? subjectIds : undefined,
      asOf: options.asOf,
    });
    if (query.contradictions && query.contradictions.length > 0) {
      alternatives = query.contradictions.flat();
      const winners = query.contradictions.map((group) => rankFacts(group)[0]);
      for (const w of winners) {
        if (!evidence.some((e) => e.fact?.id === w.id)) {
          evidence.push({ fact: w, source: w.source, entity: w.subject });
        }
      }
    }

    if (options.rag && this.retriever) {
      const passages = await this.retriever.search(question, {
        topK: 5,
        tenantId: this.scope.tenantId,
      });
      for (const p of passages) {
        evidence.push({
          source: { type: 'rag', id: p.id },
          fact: {
            subject: '_rag',
            predicate: 'passage',
            object: p.content,
            confidence: p.score ?? 0.7,
            source: { type: 'rag', id: p.id },
          },
        });
      }
    }

    const sources: KnowledgeSource[] = [];
    for (const e of evidence) {
      if (e.source) sources.push(e.source);
      if (e.fact?.source) sources.push(e.fact.source);
    }

    const confidence = aggregateConfidence(
      [
        traversal.confidence,
        ...traversal.facts.map((f) => f.confidence ?? 1),
        ...traversal.relations.map((r) => r.confidence ?? 1),
      ],
      this.confidenceAggregation
    );

    const explanation = options.explain
      ? formatExplanation(evidence, confidence, plan.template)
      : undefined;

    let answer: string | undefined;
    if (this.llm) {
      const prompt =
        `Answer using ONLY the following evidence. Do not invent facts.\n` +
        `Question: ${question}\n` +
        `Evidence:\n${JSON.stringify(evidence, null, 2)}\n` +
        `Confidence: ${confidence.toFixed(2)}`;
      answer = await this.llm(prompt);
    } else {
      answer = explanation ?? summarizeEvidence(evidence);
    }

    const result: KnowledgeAnswer = {
      answer,
      evidence,
      sources: dedupeSources(sources),
      confidence,
      alternatives,
      explanation,
    };

    this.emit(KAG_EVENTS.QUERY_COMPLETED, { question, confidence, evidenceCount: evidence.length });
    return result;
  }

  async promoteObservation(observation: ObservationPromotion): Promise<KnowledgeFact | null> {
    if (!observation.validated) {
      return null;
    }
    if (observation.confidence === undefined || observation.confidence < 0) {
      throw KagError.validationError('Validated observations require a confidence score.');
    }
    const fact: KnowledgeFact = {
      id: randomUUID(),
      subject: observation.subject,
      predicate: observation.predicate,
      object: observation.object,
      confidence: observation.confidence,
      source: observation.source ?? { type: 'memory', id: 'promotion' },
      validFrom: observation.validFrom,
      validUntil: observation.validUntil,
    };
    await this.fact(fact);
    return fact;
  }

  async changes(from: Date | string, to: Date | string): Promise<KnowledgeFact[]> {
    const result = await this.store.query(this.scope, {});
    return changesBetween(result.facts, from, to);
  }

  async currentFacts(subject?: string): Promise<KnowledgeFact[]> {
    const result = await this.store.query(this.scope, {
      entityIds: subject ? [subject] : undefined,
      currentOnly: true,
    });
    return result.facts.filter((f) => isFactValidAt(f));
  }

  async contribute(request: {
    query: string;
    tenantId: string;
    namespace?: string;
    agentId?: string;
  }): Promise<ContextContribution> {
    if (request.tenantId !== this.scope.tenantId) {
      throw KagError.accessDenied('tenant');
    }
    const answer = await this.ask(request.query, { explain: true });
    return {
      text: answer.answer ?? answer.explanation ?? '',
      evidence: answer.evidence,
      fingerprint: `${this.scope.tenantId}:${answer.confidence}:${answer.evidence.length}`,
    };
  }

  private emit(event: string, payload: unknown): void {
    this.localEmitter.emit(event, payload);
    this.externalEmitter?.emit(event, payload);
  }
}

function formatExplanation(
  evidence: KnowledgeEvidence[],
  confidence: number,
  template?: string
): string {
  const lines = evidence.map((e) => {
    if (e.relation && e.entity && e.entity2) {
      return `${e.entity} -[${e.relation}]-> ${e.entity2}`;
    }
    if (e.fact) {
      return (
        `${e.fact.subject}.${e.fact.predicate} = ${JSON.stringify(e.fact.object)}` +
        (e.fact.source
          ? ` (source: ${e.fact.source.type}${e.fact.source.id ? ':' + e.fact.source.id : ''})`
          : '')
      );
    }
    return JSON.stringify(e);
  });
  const header = template ? `Template: ${template}\n` : '';
  return `${header}Evidence path (confidence ${confidence.toFixed(2)}):\n` + lines.join('\n');
}

function summarizeEvidence(evidence: KnowledgeEvidence[]): string {
  if (evidence.length === 0) return 'No knowledge evidence found.';
  return evidence
    .slice(0, 8)
    .map((e) => {
      if (e.relation) return `${e.entity} ${e.relation} ${e.entity2}`;
      if (e.fact) return `${e.fact.subject} ${e.fact.predicate} ${JSON.stringify(e.fact.object)}`;
      return '';
    })
    .filter(Boolean)
    .join('; ');
}

function dedupeSources(sources: KnowledgeSource[]): KnowledgeSource[] {
  const seen = new Set<string>();
  const out: KnowledgeSource[] = [];
  for (const s of sources) {
    const key = `${s.type}:${s.id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
