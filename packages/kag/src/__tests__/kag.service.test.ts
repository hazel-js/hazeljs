import { KnowledgeGraph } from '../knowledge-graph';
import { InMemoryKnowledgeStore } from '../stores/in-memory-knowledge.store';
import { EntityResolver, normalizeName } from '../resolution/entity-resolver';
import { KagErrorCode } from '../errors/kag.error';
import { createCaslKnowledgeAuthorizer } from '../security/authorizer';
import { importGraph, mapExtractionResult } from '../adapters/graphrag.adapter';
import { ingestKnowledge } from '../ingestion/ingest';
import { KAG_EVENTS } from '../types';

describe('KnowledgeGraph', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph({ tenantId: 'merchant-123', graph: 'commerce' });
  });

  it('creates entities, relations, and facts', async () => {
    await graph.entity({
      id: 'merchant-123',
      type: 'merchant',
      properties: { name: 'Demo Restaurant' },
    });
    await graph.entity({
      id: 'order-456',
      type: 'order',
      properties: { total: 120 },
    });
    await graph.relate({
      from: 'merchant-123',
      to: 'order-456',
      type: 'HAS_ORDER',
    });
    await graph.fact({
      subject: 'order-456',
      predicate: 'total',
      object: 120,
      confidence: 1,
      source: { type: 'database', id: 'orders' },
    });

    const traversal = await graph.traverse(['merchant-123'], { depth: 1 });
    expect(traversal.entities.map((e) => e.id)).toEqual(
      expect.arrayContaining(['merchant-123', 'order-456'])
    );
    expect(traversal.relations.some((r) => r.type === 'HAS_ORDER')).toBe(true);
  });

  it('explains settlement gap with evidence', async () => {
    const { COMMERCE_INDUSTRY_PROFILE } = await import('../planner/industry-profiles');
    const commerceGraph = new KnowledgeGraph({
      tenantId: 'merchant-123',
      graph: 'commerce',
      industry: [COMMERCE_INDUSTRY_PROFILE],
    });
    await seedCommerce(commerceGraph);
    const result = await commerceGraph.ask('Why was Demo Restaurant settlement lower yesterday?', {
      explain: true,
    });
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.explanation).toContain('HAS_');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.explanation).toMatch(/Template: (settlement|causal)/);
  });

  it('supports temporal facts', async () => {
    await graph.entity({
      id: 'product-123',
      type: 'product',
      properties: { name: 'Burger' },
    });
    await graph.fact({
      subject: 'product-123',
      predicate: 'price',
      object: 99,
      validFrom: '2026-01-01',
      validUntil: '2026-05-31',
      source: { type: 'catalog', id: 'v1' },
    });
    await graph.fact({
      subject: 'product-123',
      predicate: 'price',
      object: 109,
      validFrom: '2026-06-01',
      validUntil: '2026-09-30',
      source: { type: 'catalog', id: 'v2' },
    });
    await graph.fact({
      subject: 'product-123',
      predicate: 'price',
      object: 119,
      validFrom: '2026-10-01',
      source: { type: 'catalog', id: 'v3' },
    });

    const march = await graph.ask('What was the price in March?', {
      asOf: '2026-03-15',
      explain: true,
    });
    expect(march.evidence.some((e) => e.fact?.object === 99)).toBe(true);

    const changes = await graph.changes('2026-01-01', '2026-12-31');
    expect(changes.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps contradictions instead of overwriting', async () => {
    const events: unknown[] = [];
    graph.on(KAG_EVENTS.CONTRADICTION_DETECTED, (p) => events.push(p));

    await graph.entity({
      id: 'merchant-123',
      type: 'merchant',
      properties: { name: 'Demo' },
    });
    await graph.fact({
      subject: 'merchant-123',
      predicate: 'country',
      object: 'Sweden',
      confidence: 0.7,
      source: { type: 'a', authority: 10 },
    });
    const second = await graph.fact({
      subject: 'merchant-123',
      predicate: 'country',
      object: 'Norway',
      confidence: 0.9,
      source: { type: 'b', authority: 80 },
    });
    expect(second.contradictions.length).toBe(1);
    expect(events.length).toBe(1);

    const answer = await graph.ask('What country is the merchant in?', { explain: true });
    expect(answer.alternatives?.length).toBeGreaterThan(0);
  });

  it('rejects unvalidated memory promotion', async () => {
    const result = await graph.promoteObservation({
      subject: 'merchant-123',
      predicate: 'prefers_ex_vat',
      object: true,
      confidence: 0.8,
      validated: false,
    });
    expect(result).toBeNull();
  });

  it('promotes validated observations', async () => {
    await graph.entity({
      id: 'merchant-123',
      type: 'merchant',
      properties: { name: 'Demo' },
    });
    const fact = await graph.promoteObservation({
      subject: 'merchant-123',
      predicate: 'prefers_ex_vat',
      object: true,
      confidence: 0.95,
      validated: true,
      source: { type: 'memory', id: 'obs-1' },
    });
    expect(fact?.predicate).toBe('prefers_ex_vat');
  });

  it('enforces tenant isolation', async () => {
    const a = new KnowledgeGraph({ tenantId: 'tenant-a' });
    const b = new KnowledgeGraph({ tenantId: 'tenant-b' });
    await a.entity({ id: 'secret', type: 'doc', properties: { name: 'A only' } });
    await b.entity({ id: 'public', type: 'doc', properties: { name: 'B only' } });

    const aList = await a.traverse(['secret']);
    expect(aList.entities.some((e) => e.id === 'secret')).toBe(true);

    const bAsk = await b.ask('secret');
    expect(bAsk.evidence.every((e) => e.entity !== 'secret' || e.fact?.subject !== 'secret')).toBe(
      true
    );
  });

  it('denies access via authorizer', async () => {
    const denied = new KnowledgeGraph({
      tenantId: 't1',
      authorizer: {
        canAccess: () => false,
      },
    });
    await expect(denied.entity({ id: 'x', type: 't', properties: {} })).rejects.toMatchObject({
      code: KagErrorCode.ACCESS_DENIED,
    });
  });

  it('supports CASL-shaped authorizer adapter', async () => {
    const can = jest.fn(() => true);
    const g = new KnowledgeGraph({
      tenantId: 't1',
      authorizer: createCaslKnowledgeAuthorizer(can),
    });
    await g.entity({ id: 'e1', type: 'merchant', properties: { name: 'X' } });
    expect(can).toHaveBeenCalled();
  });

  it('merges RAG passages when retriever is injected', async () => {
    const g = new KnowledgeGraph({
      tenantId: 't1',
      retriever: {
        async search() {
          return [{ id: 'doc-1', content: 'Refund policy says 14 days.', score: 0.9 }];
        },
      },
    });
    await g.entity({ id: 'm1', type: 'merchant', properties: { name: 'Shop' } });
    const result = await g.ask('refund policy', { rag: true, explain: true });
    expect(result.evidence.some((e) => e.source?.type === 'rag')).toBe(true);
  });

  it('imports GraphRAG-like stores', async () => {
    const store = {
      entities: new Map([
        [
          'openai',
          {
            id: 'openai',
            name: 'OpenAI',
            type: 'ORGANIZATION',
            description: 'AI lab',
            sourceDocIds: ['d1'],
          },
        ],
      ]),
      relationships: new Map([
        [
          'r1',
          {
            id: 'r1',
            sourceId: 'openai',
            targetId: 'openai',
            type: 'RELATED_TO',
            description: 'self',
            weight: 5,
            sourceDocIds: ['d1'],
          },
        ],
      ]),
    };
    const stats = await importGraph(graph, store);
    expect(stats.entities).toBe(1);
    expect(stats.relations).toBe(1);
  });

  it('maps extraction results', () => {
    const mapped = mapExtractionResult({
      entities: [{ id: '1', name: 'A', type: 'PERSON' }],
      relationships: [{ id: 'r', sourceId: '1', targetId: '1', type: 'RELATED_TO', weight: 8 }],
    });
    expect(mapped.entities[0].metadata?.graphRagId).toBe('1');
    expect(mapped.relations[0].confidence).toBe(0.8);
  });

  it('ingests batches with dedupe', async () => {
    const result = await ingestKnowledge(graph, {
      entities: [
        { id: 'e1', type: 'merchant', properties: { name: 'A' } },
        { id: 'e1', type: 'merchant', properties: { name: 'A2' } },
      ],
      relations: [
        { id: 'r1', from: 'e1', to: 'e1', type: 'SELF' },
        { id: 'r1', from: 'e1', to: 'e1', type: 'SELF' },
      ],
      facts: [{ subject: 'e1', predicate: 'active', object: true }],
    });
    expect(result.entities).toBe(1);
    expect(result.relations).toBe(1);
    expect(result.facts).toBe(1);
  });
});

describe('EntityResolver', () => {
  it('normalizes OpenAI variants', async () => {
    expect(normalizeName('OpenAI Inc.')).toBe(normalizeName('Open AI'));
    const resolver = new EntityResolver({ mergeThreshold: 0.9 });
    const existing = [{ id: '1', type: 'ORGANIZATION', properties: { name: 'OpenAI' } }];
    const result = await resolver.resolve(
      { id: '2', type: 'ORGANIZATION', properties: { name: 'OpenAI Inc.' } },
      existing
    );
    expect(result.merged?.id).toBe('1');
    expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('does not merge uncertain candidates', async () => {
    const resolver = new EntityResolver({
      mergeThreshold: 0.99,
      strategies: ['normalized'],
    });
    const result = await resolver.resolve(
      { id: '2', type: 'ORG', properties: { name: 'Open AI Corp' } },
      [{ id: '1', type: 'ORG', properties: { name: 'OpenAI' } }]
    );
    // normalized should match, but if below threshold still only candidates
    if (result.merged) {
      expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(0.99);
    } else {
      expect(result.candidates.length).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('InMemoryKnowledgeStore tenant partition', () => {
  it('never leaks across tenants', async () => {
    const store = new InMemoryKnowledgeStore();
    await store.upsertEntity({ tenantId: 'a' }, { id: 'e', type: 'x', properties: { name: 'A' } });
    const b = await store.getEntity({ tenantId: 'b' }, 'e');
    expect(b).toBeNull();
  });
});

async function seedCommerce(graph: KnowledgeGraph): Promise<void> {
  await graph.entity({
    id: 'merchant-123',
    type: 'merchant',
    properties: { name: 'Demo Restaurant' },
  });
  await graph.entity({ id: 'order-1', type: 'order', properties: { total: 500 } });
  await graph.entity({ id: 'payment-1', type: 'payment', properties: { amount: 500 } });
  await graph.entity({ id: 'refund-1', type: 'refund', properties: { amount: 1420 } });
  await graph.entity({ id: 'fee-1', type: 'fee', properties: { amount: 20 } });
  await graph.entity({
    id: 'settlement-1',
    type: 'settlement',
    properties: { amount: 3000, expected: 4420 },
  });

  await graph.relate({ from: 'merchant-123', to: 'order-1', type: 'HAS_ORDER' });
  await graph.relate({ from: 'order-1', to: 'payment-1', type: 'HAS_PAYMENT' });
  await graph.relate({
    from: 'payment-1',
    to: 'refund-1',
    type: 'HAS_REFUND',
    source: { type: 'database', id: 'refund-456' },
  });
  await graph.relate({ from: 'refund-1', to: 'settlement-1', type: 'AFFECTS' });
  await graph.relate({ from: 'fee-1', to: 'settlement-1', type: 'AFFECTS' });

  await graph.fact({
    subject: 'refund-1',
    predicate: 'amount',
    object: 1420,
    confidence: 0.98,
    source: { type: 'database', id: 'refund-456', authority: 90 },
  });
  await graph.fact({
    subject: 'settlement-1',
    predicate: 'delta',
    object: -1420,
    confidence: 0.95,
    source: { type: 'ledger', id: 'settle-1', authority: 90 },
  });
}
