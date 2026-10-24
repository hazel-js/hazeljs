import { CagModule } from '../cag.module';
import { CagService } from '../cag.service';
import { MemoryCagStore } from '../stores/memory-cag.store';
import { FakeRedisClient, RedisCagStore } from '../stores/redis-cag.store';
import { TokenBudgetManager, estimateTokens } from '../budget/token-budget';
import { parseTtlSeconds } from '../ttl';
import { CagError, CagErrorCode } from '../errors/cag.error';
import { ContextSource, getContextSourceMetadata } from '../sources/context-source.decorator';
import type { ContextLoadInput, LoadedSourceChunk } from '../types';
import { buildCacheKey, buildKeyPrefix } from '../fingerprint/context-fingerprint';

describe('CagModule', () => {
  it('forRoot returns providers', () => {
    const mod = CagModule.forRoot({ store: 'memory', ttl: '30m' });
    expect(mod.module).toBe(CagModule);
    expect(mod.exports).toContain(CagService);
  });

  it('forRootAsync wires factory', async () => {
    const mod = CagModule.forRootAsync({
      useFactory: () => ({ store: 'memory' as const, maxTokens: 100 }),
    });
    const factory = mod.providers.find((p) => p.provide === CagService)?.useFactory;
    expect(factory).toBeDefined();
    const service = (await factory!({ store: 'memory', maxTokens: 100 })) as CagService;
    expect(service.kind).toBe('cag');
  });

  it('rejects redis without client', () => {
    expect(() => CagModule.forRoot({ store: 'redis' })).toThrow(/redis.client/);
  });

  it('accepts redis with FakeRedisClient', () => {
    const mod = CagModule.forRoot({
      store: 'redis',
      redis: { client: new FakeRedisClient() },
    });
    expect(mod.providers.length).toBeGreaterThan(0);
  });
});

describe('parseTtlSeconds', () => {
  it('parses units', () => {
    expect(parseTtlSeconds('1h')).toBe(3600);
    expect(parseTtlSeconds('30m')).toBe(1800);
    expect(parseTtlSeconds(120)).toBe(120);
    expect(parseTtlSeconds('2d')).toBe(172800);
  });
});

describe('TokenBudget truncate and summarize', () => {
  const chunks = (
    items: Array<Partial<LoadedSourceChunk> & { id: string; content: string }>
  ): LoadedSourceChunk[] =>
    items.map((i) => ({
      priority: 50,
      compressible: true,
      tokenEstimate: estimateTokens(i.content),
      ...i,
    }));

  it('truncates long content', async () => {
    const mgr = new TokenBudgetManager(10, 'truncate');
    const result = await mgr.apply(chunks([{ id: 'a', content: 'word '.repeat(200) }]));
    expect(result.truncated).toBe(true);
    expect(result.tokenCount).toBeLessThanOrEqual(10);
  });

  it('summarizes when summarizer provided', async () => {
    const mgr = new TokenBudgetManager(20, 'summarize', estimateTokens, () => 'short summary');
    const result = await mgr.apply(chunks([{ id: 'a', content: 'x'.repeat(500) }]));
    expect(result.text).toBe('short summary');
    expect(result.strategy).toBe('summarize');
  });
});

describe('@ContextSource', () => {
  @ContextSource({ namespace: 'policy', ttl: '6h', priority: 100 })
  class Policy {
    load(_input: ContextLoadInput) {
      return 'rules';
    }
  }

  it('stores metadata and registers via service', async () => {
    expect(getContextSourceMetadata(Policy)?.namespace).toBe('policy');
    const service = new CagService({ multiTenant: true }, new MemoryCagStore());
    service.registerClass(Policy);
    const ctx = await service.getContext({ namespace: 'policy', tenantId: 't1' });
    expect(ctx.context.text).toBe('rules');
  });
});

describe('fingerprint helpers', () => {
  it('builds keys and prefixes', () => {
    expect(
      buildCacheKey({
        tenantId: 't',
        namespace: 'n',
        fingerprint: 'abc',
      })
    ).toContain('cag:t');
    expect(buildKeyPrefix({ tenantId: 't', namespace: 'n' })).toContain('cag:t');
  });
});

describe('RedisCagStore errors', () => {
  it('maps get failures', async () => {
    const client = {
      async get() {
        throw new Error('down');
      },
      async set() {
        return 'OK';
      },
      async del() {
        return 0;
      },
      async keys() {
        return [];
      },
    };
    const store = new RedisCagStore(client);
    await expect(store.get('k')).rejects.toMatchObject({ code: CagErrorCode.STORE_ERROR });
  });
});

describe('CagError factories', () => {
  it('creates typed errors', () => {
    expect(CagError.contextNotFound('n', 't').code).toBe(CagErrorCode.CONTEXT_NOT_FOUND);
    expect(CagError.configurationError('x').code).toBe(CagErrorCode.CONFIGURATION_ERROR);
  });
});
