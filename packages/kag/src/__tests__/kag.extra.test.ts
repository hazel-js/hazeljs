import { KagModule } from '../kag.module';
import { KagService } from '../kag.service';
import { KnowledgeGraph } from '../knowledge-graph';
import { KagError, KagErrorCode } from '../errors/kag.error';
import { rankFacts, aggregateConfidence } from '../confidence';
import { InMemoryKnowledgeStore } from '../stores/in-memory-knowledge.store';

describe('KagModule and KagService', () => {
  it('forRoot provides KagService', () => {
    const mod = KagModule.forRoot({ tenantId: 't1' });
    expect(mod.exports).toContain(KagService);
  });

  it('forRootAsync factory works', async () => {
    const mod = KagModule.forRootAsync({
      useFactory: () => ({ tenantId: 't1' }),
    });
    const factory = mod.providers.find((p) => p.provide === KagService)?.useFactory;
    const service = (await factory!({ tenantId: 't1' })) as KagService;
    await service.entity({ id: 'e1', type: 'x', properties: { name: 'N' } });
    const answer = await service.ask('N', { explain: true });
    expect(answer.confidence).toBeGreaterThan(0);
  });

  it('forTenant isolates graphs', async () => {
    const service = new KagService({});
    await service.entity({ id: 'a', type: 't', properties: { name: 'A' } }, { tenantId: 'ten-a' });
    await service.entity({ id: 'b', type: 't', properties: { name: 'B' } }, { tenantId: 'ten-b' });
    const a = await service.ask('A', { tenantId: 'ten-a', explain: true });
    expect(a.evidence.some((e) => e.entity === 'b')).toBe(false);
  });

  it('importGraphRag and ingest via service', async () => {
    const service = new KagService({ tenantId: 't1' });
    await service.importGraphRag({
      entities: [{ id: 'g1', name: 'G', type: 'ORG' }],
      relationships: [],
    });
    await service.ingest({
      entities: [{ id: 'e2', type: 'node', properties: { name: 'E2' } }],
      facts: [{ subject: 'e2', predicate: 'ok', object: true }],
    });
    const result = await service.contribute({
      query: 'E2',
      tenantId: 't1',
    });
    expect(result.text.length).toBeGreaterThan(0);
  });
});

describe('confidence helpers', () => {
  it('aggregates min and product', () => {
    expect(aggregateConfidence([0.9, 0.8], 'min')).toBe(0.8);
    expect(aggregateConfidence([0.5, 0.5], 'product')).toBe(0.25);
  });

  it('ranks by authority', () => {
    const ranked = rankFacts([
      { subject: 's', predicate: 'p', object: 1, source: { type: 'a', authority: 1 } },
      { subject: 's', predicate: 'p', object: 2, source: { type: 'b', authority: 99 } },
    ]);
    expect(ranked[0].object).toBe(2);
  });
});

describe('KagError', () => {
  it('factories', () => {
    expect(KagError.entityNotFound('x').code).toBe(KagErrorCode.ENTITY_NOT_FOUND);
    expect(KagError.conflict('c').code).toBe(KagErrorCode.CONFLICT);
  });
});

describe('reject contradiction policy', () => {
  it('throws on conflicting write', async () => {
    const store = new InMemoryKnowledgeStore('reject');
    const graph = new KnowledgeGraph({
      tenantId: 't',
      store,
      contradictionPolicy: 'reject',
    });
    await graph.entity({ id: 'e', type: 't', properties: {} });
    await graph.fact({ subject: 'e', predicate: 'x', object: 1 });
    await expect(graph.fact({ subject: 'e', predicate: 'x', object: 2 })).rejects.toMatchObject({
      code: KagErrorCode.CONFLICT,
    });
  });
});
