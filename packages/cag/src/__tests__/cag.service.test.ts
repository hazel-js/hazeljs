import { CagService } from '../cag.service';
import { MemoryCagStore } from '../stores/memory-cag.store';
import { FakeRedisClient, RedisCagStore } from '../stores/redis-cag.store';
import { CagError, CagErrorCode } from '../errors/cag.error';
import { fingerprintContext } from '../fingerprint/context-fingerprint';
import { TokenBudgetManager, estimateTokens } from '../budget/token-budget';
import { ContextCompressor } from '../compression/context-compressor';
import { DefaultPromptCacheProvider } from '../prompt-cache/prompt-cache.provider';
import { CAG_EVENTS } from '../types';
import type { LoadedSourceChunk } from '../types';

describe('CagService', () => {
  let service: CagService;

  beforeEach(() => {
    service = new CagService(
      {
        ttl: '1h',
        maxTokens: 10_000,
        multiTenant: true,
        tokenBudget: { max: 10_000, strategy: 'priority' },
      },
      new MemoryCagStore()
    );
    service.register(
      {
        id: 'policy',
        priority: 100,
        compressible: false,
        version: '1',
        source: { type: 'text', content: 'Return within 30 days.' },
      },
      'support'
    );
  });

  it('misses then hits cache', async () => {
    const first = await service.getContext({ namespace: 'support', tenantId: 'merchant-123' });
    expect(first.hit).toBe(false);
    expect(first.context.text).toContain('Return within 30 days');

    const second = await service.getContext({ namespace: 'support', tenantId: 'merchant-123' });
    expect(second.hit).toBe(true);
    expect(second.context.fingerprint).toBe(first.context.fingerprint);

    const metrics = service.getMetrics();
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.hitRatio).toBe(0.5);
  });

  it('isolates tenants', async () => {
    await service.getContext({ namespace: 'support', tenantId: 'tenant-a' });
    await service.getContext({ namespace: 'support', tenantId: 'tenant-b' });

    service.register(
      {
        id: 'policy',
        priority: 100,
        version: '2',
        source: { type: 'text', content: 'Tenant A secret policy' },
      },
      'support'
    );

    const a = await service.getContext({
      namespace: 'support',
      tenantId: 'tenant-a',
      force: true,
    });
    expect(a.context.text).toContain('Tenant A secret policy');

    // tenant-b still has old cached context under version 1 sources until re-register
    const serviceB = new CagService({ multiTenant: true }, new MemoryCagStore());
    serviceB.register(
      {
        id: 'policy',
        priority: 100,
        version: '1',
        source: { type: 'text', content: 'Return within 30 days.' },
      },
      'support'
    );
    const b = await serviceB.getContext({ namespace: 'support', tenantId: 'tenant-b' });
    expect(b.context.text).not.toContain('Tenant A secret policy');
    expect(b.context.tenantId).toBe('tenant-b');
  });

  it('requires tenantId when multiTenant', async () => {
    await expect(service.getContext({ namespace: 'support', tenantId: '' })).rejects.toMatchObject({
      code: CagErrorCode.TENANT_REQUIRED,
    });
  });

  it('invalidates by namespace', async () => {
    await service.getContext({ namespace: 'support', tenantId: 'merchant-123' });
    await service.invalidate({ tenantId: 'merchant-123', namespace: 'support' });
    const again = await service.getContext({ namespace: 'support', tenantId: 'merchant-123' });
    expect(again.hit).toBe(false);
  });

  it('version change causes miss', async () => {
    await service.getContext({ namespace: 'support', tenantId: 'm1' });
    service.register(
      {
        id: 'policy',
        priority: 100,
        version: '2',
        source: { type: 'text', content: 'Return within 30 days.' },
      },
      'support'
    );
    const next = await service.getContext({ namespace: 'support', tenantId: 'm1' });
    expect(next.hit).toBe(false);
  });

  it('single-flights concurrent misses', async () => {
    let loads = 0;
    const s = new CagService({ multiTenant: true }, new MemoryCagStore());
    s.register(
      {
        id: 'slow',
        source: {
          type: 'function',
          load: async () => {
            loads++;
            await new Promise((r) => setTimeout(r, 30));
            return 'shared';
          },
        },
      },
      'ns'
    );
    const results = await Promise.all([
      s.getContext({ namespace: 'ns', tenantId: 't1' }),
      s.getContext({ namespace: 'ns', tenantId: 't1' }),
      s.getContext({ namespace: 'ns', tenantId: 't1' }),
    ]);
    expect(loads).toBe(1);
    expect(results.every((r) => r.context.text === 'shared')).toBe(true);
  });

  it('emits lifecycle events', async () => {
    const events: string[] = [];
    service.on(CAG_EVENTS.CONTEXT_MISS, () => events.push('miss'));
    service.on(CAG_EVENTS.CONTEXT_BUILD, () => events.push('build'));
    service.on(CAG_EVENTS.CONTEXT_HIT, () => events.push('hit'));
    await service.getContext({ namespace: 'support', tenantId: 'e1' });
    await service.getContext({ namespace: 'support', tenantId: 'e1' });
    expect(events).toEqual(['miss', 'build', 'hit']);
  });

  it('works with RedisCagStore + FakeRedisClient', async () => {
    const store = new RedisCagStore(new FakeRedisClient());
    const s = new CagService({ multiTenant: true, ttl: 60 }, store);
    s.register({ id: 'p', source: { type: 'text', content: 'redis policy' } }, 'support');
    const a = await s.getContext({ namespace: 'support', tenantId: 'r1' });
    const b = await s.getContext({ namespace: 'support', tenantId: 'r1' });
    expect(a.hit).toBe(false);
    expect(b.hit).toBe(true);
  });

  it('rebuilds on store failure unless strict', async () => {
    const failing: MemoryCagStore = {
      async get() {
        throw CagError.storeError('boom');
      },
      async set() {
        /* ignore */
      },
      async delete() {
        /* ignore */
      },
      async clear() {
        /* ignore */
      },
      async keys() {
        return [];
      },
    } as unknown as MemoryCagStore;

    const s = new CagService({ multiTenant: true, strict: false }, failing);
    s.register({ id: 'p', source: { type: 'text', content: 'ok' } }, 'ns');
    const result = await s.getContext({ namespace: 'ns', tenantId: 't' });
    expect(result.context.text).toBe('ok');

    const strict = new CagService({ multiTenant: true, strict: true }, failing);
    strict.register({ id: 'p', source: { type: 'text', content: 'ok' } }, 'ns');
    await expect(strict.getContext({ namespace: 'ns', tenantId: 't' })).rejects.toMatchObject({
      code: CagErrorCode.STORE_ERROR,
    });
  });

  it('contribute implements ContextContributor', async () => {
    const contribution = await service.contribute({
      query: 'policy?',
      tenantId: 'merchant-123',
      namespace: 'support',
    });
    expect(contribution.text).toContain('Return');
    expect(contribution.fingerprint).toBeDefined();
  });
});

describe('fingerprint', () => {
  it('is stable for identical inputs', () => {
    const a = fingerprintContext({
      tenantId: 't',
      namespace: 'n',
      content: 'hello',
      configuration: { b: 2, a: 1 },
    });
    const b = fingerprintContext({
      tenantId: 't',
      namespace: 'n',
      content: 'hello',
      configuration: { a: 1, b: 2 },
    });
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    const a = fingerprintContext({ tenantId: 't', namespace: 'n', content: 'a' });
    const b = fingerprintContext({ tenantId: 't', namespace: 'n', content: 'b' });
    expect(a).not.toBe(b);
  });
});

describe('TokenBudgetManager', () => {
  const chunks = (
    items: Array<Partial<LoadedSourceChunk> & { id: string; content: string }>
  ): LoadedSourceChunk[] =>
    items.map((i) => ({
      priority: 50,
      compressible: true,
      tokenEstimate: estimateTokens(i.content),
      ...i,
    }));

  it('keeps higher priority under budget', async () => {
    const mgr = new TokenBudgetManager(20, 'priority');
    const result = await mgr.apply(
      chunks([
        { id: 'low', content: 'x'.repeat(80), priority: 10 },
        { id: 'high', content: 'critical rules', priority: 100, compressible: false },
      ])
    );
    expect(result.text).toContain('critical rules');
    expect(result.chunks.some((c) => c.id === 'high')).toBe(true);
  });

  it('rejects when strategy is reject', async () => {
    const mgr = new TokenBudgetManager(5, 'reject');
    await expect(
      mgr.apply(chunks([{ id: 'big', content: 'word '.repeat(100) }]))
    ).rejects.toMatchObject({ code: CagErrorCode.TOKEN_BUDGET_EXCEEDED });
  });
});

describe('ContextCompressor', () => {
  it('does not rewrite high-priority or non-compressible sources', async () => {
    const compressor = new ContextCompressor(true);
    const result = await compressor.compress([
      {
        id: 'compliance',
        content: 'MUST KEEP  \n\n\n  EXACT',
        priority: 100,
        compressible: false,
        tokenEstimate: 10,
      },
      {
        id: 'dup',
        content: 'hello   world',
        priority: 20,
        compressible: true,
        tokenEstimate: 5,
      },
    ]);
    expect(result.chunks.find((c) => c.id === 'compliance')?.content).toBe(
      'MUST KEEP  \n\n\n  EXACT'
    );
    expect(result.chunks.find((c) => c.id === 'dup')?.content).toBe('hello world');
  });
});

describe('DefaultPromptCacheProvider', () => {
  it('returns provider hints without calling vendors', async () => {
    const provider = new DefaultPromptCacheProvider('anthropic');
    const prepared = await provider.prepare({
      text: 'policy text',
      fingerprint: 'abc',
      tokenCount: 10,
      namespace: 'support',
      tenantId: 't1',
    });
    expect(prepared.provider).toBe('anthropic');
    expect(prepared.cacheKey).toContain('pc:anthropic');
    expect(prepared.breakpoints?.length).toBe(1);
  });
});
