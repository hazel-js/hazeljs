import { Service } from '@hazeljs/core';
import EventEmitter from 'eventemitter3';
import type {
  CachedContext,
  CagMetrics,
  CagModuleOptions,
  CagStore,
  ContextContributor,
  ContextContribution,
  ContextSourceDefinition,
  GetContextInput,
  InvalidateInput,
  PromptCacheProvider,
  ProviderCachedContext,
} from './types';
import { CAG_EVENTS } from './types';
import { CagError } from './errors/cag.error';
import { ContextLoader } from './sources/context-loader';
import { TokenBudgetManager, estimateTokens } from './budget/token-budget';
import { ContextCompressor } from './compression/context-compressor';
import { buildCacheKey, fingerprintContext } from './fingerprint/context-fingerprint';
import { parseTtlSeconds } from './ttl';
import { MemoryCagStore } from './stores/memory-cag.store';
import {
  getContextSourceMetadata,
  type ContextSourceClass,
} from './sources/context-source.decorator';

export interface GetContextResult {
  context: CachedContext;
  hit: boolean;
  promptCache?: ProviderCachedContext;
}

@Service()
export class CagService implements ContextContributor {
  readonly kind = 'cag' as const;

  private readonly store: CagStore;
  private readonly sources = new Map<string, ContextSourceDefinition[]>();
  private readonly loader: ContextLoader;
  private readonly compressor: ContextCompressor;
  private readonly tokenCounter: (text: string) => number;
  private readonly multiTenant: boolean;
  private readonly strict: boolean;
  private readonly defaultTtlSeconds: number;
  private readonly maxTokens: number;
  private readonly budgetStrategy: NonNullable<
    NonNullable<CagModuleOptions['tokenBudget']>['strategy']
  >;
  private readonly promptCache?: PromptCacheProvider;
  private readonly summarizer?: CagModuleOptions['summarizer'];
  private readonly usdPerMillionInputTokens?: number;
  private readonly externalEmitter?: CagModuleOptions['eventEmitter'];
  private readonly localEmitter = new EventEmitter();
  private readonly inflight = new Map<string, Promise<GetContextResult>>();
  private readonly metrics: CagMetrics = {
    hits: 0,
    misses: 0,
    builds: 0,
    invalidations: 0,
    compressions: 0,
    hitRatio: 0,
    lastBuildLatencyMs: 0,
    lastContextSize: 0,
    lastTokenCount: 0,
    tokensSaved: 0,
  };

  constructor(options: CagModuleOptions = {}, store?: CagStore) {
    this.store = store ?? new MemoryCagStore();
    this.tokenCounter = options.tokenCounter ?? estimateTokens;
    this.loader = new ContextLoader(this.tokenCounter);
    this.compressor = new ContextCompressor(
      Boolean(options.compression),
      undefined,
      this.tokenCounter
    );
    this.multiTenant = options.multiTenant !== false;
    this.strict = Boolean(options.strict);
    this.defaultTtlSeconds = parseTtlSeconds(options.ttl, 3600);
    this.maxTokens = options.tokenBudget?.max ?? options.maxTokens ?? 50_000;
    this.budgetStrategy = options.tokenBudget?.strategy ?? 'priority';
    this.promptCache = options.promptCache;
    this.summarizer = options.summarizer;
    this.usdPerMillionInputTokens = options.usdPerMillionInputTokens;
    this.externalEmitter = options.eventEmitter;

    if (options.sources) {
      for (const source of options.sources) {
        this.register(source);
      }
    }
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    this.localEmitter.on(event, listener);
    return this;
  }

  register(source: ContextSourceDefinition, namespace = 'default'): void {
    const list = this.sources.get(namespace) ?? [];
    const existing = list.findIndex((s) => s.id === source.id);
    if (existing >= 0) {
      list[existing] = source;
    } else {
      list.push(source);
    }
    this.sources.set(namespace, list);
  }

  registerClass(ctor: new () => ContextSourceClass, instance?: ContextSourceClass): void {
    const meta = getContextSourceMetadata(ctor);
    if (!meta) {
      throw CagError.configurationError(`Class ${ctor.name} is missing @ContextSource() metadata.`);
    }
    const obj = instance ?? new ctor();
    this.register(
      {
        id: meta.id ?? ctor.name,
        priority: meta.priority,
        compressible: meta.compressible,
        ttl: meta.ttl,
        source: {
          type: 'function',
          load: (input) => obj.load(input),
        },
      },
      meta.namespace
    );
  }

  async getContext(input: GetContextInput): Promise<GetContextResult> {
    this.assertTenant(input.tenantId);
    const namespaceSources = this.sources.get(input.namespace) ?? [];
    if (namespaceSources.length === 0) {
      throw CagError.contextNotFound(input.namespace, input.tenantId);
    }

    const flightKey = [
      input.tenantId,
      input.agentId ?? '_',
      input.namespace,
      input.version ?? '_',
      input.force ? 'force' : 'cache',
    ].join('|');

    if (!input.force) {
      const existing = this.inflight.get(flightKey);
      if (existing) return existing;
    }

    const promise = this.resolveContext(input, namespaceSources);
    if (!input.force) {
      this.inflight.set(flightKey, promise);
    }
    try {
      return await promise;
    } finally {
      this.inflight.delete(flightKey);
    }
  }

  async contribute(request: {
    query: string;
    tenantId: string;
    namespace?: string;
    agentId?: string;
  }): Promise<ContextContribution> {
    const result = await this.getContext({
      namespace: request.namespace ?? 'default',
      tenantId: request.tenantId,
      agentId: request.agentId,
    });
    return {
      text: result.context.text,
      fingerprint: result.context.fingerprint,
      evidence: result.context.sourceIds.map((id) => ({ sourceId: id })),
    };
  }

  async invalidate(input: InvalidateInput): Promise<number> {
    this.assertTenant(input.tenantId);
    const patterns = [
      this.invalidatePattern(input),
      input.namespace
        ? `cag:lookup:${input.tenantId}:*:${input.namespace}:*`
        : `cag:lookup:${input.tenantId}:*`,
    ];
    const deleted = new Set<string>();
    for (const pattern of patterns) {
      const keys = this.store.keys ? await this.store.keys(pattern) : [];
      for (const key of keys) {
        await this.store.delete(key);
        deleted.add(key);
      }
      if (keys.length === 0) {
        await this.store.clear(pattern.replace(/\*$/, ''));
      }
    }
    this.metrics.invalidations++;
    this.emit(CAG_EVENTS.CONTEXT_INVALIDATE, { ...input, patterns: [...patterns] });
    return deleted.size;
  }

  getMetrics(): CagMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRatio: total === 0 ? 0 : this.metrics.hits / total,
      estimatedCostSaved:
        this.usdPerMillionInputTokens !== undefined
          ? (this.metrics.tokensSaved / 1_000_000) * this.usdPerMillionInputTokens
          : undefined,
    };
  }

  private lookupKey(input: GetContextInput, sourceVersion: string): string {
    return [
      'cag',
      'lookup',
      input.tenantId,
      input.agentId ?? '_',
      input.namespace,
      input.version ?? '_',
      sourceVersion,
    ].join(':');
  }

  private async resolveContext(
    input: GetContextInput,
    namespaceSources: ContextSourceDefinition[]
  ): Promise<GetContextResult> {
    const loadInput = {
      tenantId: input.tenantId,
      namespace: input.namespace,
      agentId: input.agentId,
      version: input.version,
      metadata: input.metadata,
    };

    const sourceVersion = namespaceSources.map((s) => `${s.id}@${s.version ?? '1'}`).join(',');
    const lookupKey = this.lookupKey(input, sourceVersion);
    const started = Date.now();

    if (!input.force) {
      try {
        const cached = await this.store.get(lookupKey);
        if (cached) {
          this.metrics.hits++;
          this.metrics.tokensSaved += cached.tokenCount;
          this.emit(CAG_EVENTS.CONTEXT_HIT, {
            namespace: input.namespace,
            tenantId: input.tenantId,
            fingerprint: cached.fingerprint,
          });
          const promptCache = this.promptCache
            ? await this.promptCache.prepare({
                text: cached.text,
                fingerprint: cached.fingerprint,
                tokenCount: cached.tokenCount,
                namespace: cached.namespace,
                tenantId: cached.tenantId,
              })
            : undefined;
          return { context: cached, hit: true, promptCache };
        }
      } catch (err) {
        this.emit(CAG_EVENTS.STORE_ERROR, { op: 'get', error: err });
        if (this.strict) {
          throw err instanceof CagError
            ? err
            : CagError.storeError('Store get failed', err instanceof Error ? err : undefined);
        }
      }
    }

    this.metrics.misses++;
    this.emit(CAG_EVENTS.CONTEXT_MISS, {
      namespace: input.namespace,
      tenantId: input.tenantId,
    });

    let chunks = await this.loader.loadAll(namespaceSources, loadInput);

    const compressed = await this.compressor.compress(chunks);
    chunks = compressed.chunks;
    const compressionRatio = compressed.ratio;
    if (compressionRatio < 1) {
      this.metrics.compressions++;
      this.emit(CAG_EVENTS.CONTEXT_COMPRESS, {
        namespace: input.namespace,
        tenantId: input.tenantId,
        ratio: compressionRatio,
      });
    }

    const budget = new TokenBudgetManager(
      this.maxTokens,
      this.budgetStrategy,
      this.tokenCounter,
      this.summarizer
    );
    const assembled = await budget.apply(chunks);
    const fingerprint = fingerprintContext({
      tenantId: input.tenantId,
      agentId: input.agentId,
      namespace: input.namespace,
      sourceVersion,
      content: assembled.text,
      configuration: {
        maxTokens: this.maxTokens,
        strategy: this.budgetStrategy,
        compression: compressionRatio,
      },
    });

    const cacheKey = buildCacheKey({
      tenantId: input.tenantId,
      agentId: input.agentId,
      namespace: input.namespace,
      version: input.version,
      fingerprint,
    });

    const ttl = this.resolveTtl(namespaceSources);
    const context: CachedContext = {
      text: assembled.text,
      fingerprint,
      tokenCount: assembled.tokenCount,
      namespace: input.namespace,
      tenantId: input.tenantId,
      agentId: input.agentId,
      version: input.version,
      sourceIds: assembled.chunks.map((c) => c.id),
      builtAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
      compressionRatio,
    };

    try {
      await this.store.set(cacheKey, context, { ttlSeconds: ttl });
      await this.store.set(lookupKey, context, { ttlSeconds: ttl });
    } catch (err) {
      this.emit(CAG_EVENTS.STORE_ERROR, { op: 'set', error: err });
      if (this.strict) {
        throw err instanceof CagError
          ? err
          : CagError.storeError('Store set failed', err instanceof Error ? err : undefined);
      }
    }

    this.metrics.builds++;
    this.metrics.lastBuildLatencyMs = Date.now() - started;
    this.metrics.lastContextSize = context.text.length;
    this.metrics.lastTokenCount = context.tokenCount;
    this.emit(CAG_EVENTS.CONTEXT_BUILD, {
      namespace: input.namespace,
      tenantId: input.tenantId,
      fingerprint,
      tokenCount: context.tokenCount,
      latencyMs: this.metrics.lastBuildLatencyMs,
    });

    const promptCache = this.promptCache
      ? await this.promptCache.prepare({
          text: context.text,
          fingerprint: context.fingerprint,
          tokenCount: context.tokenCount,
          namespace: context.namespace,
          tenantId: context.tenantId,
        })
      : undefined;

    return { context, hit: false, promptCache };
  }

  private resolveTtl(sources: ContextSourceDefinition[]): number {
    const sourceTtls = sources
      .map((s) => (s.ttl !== undefined ? parseTtlSeconds(s.ttl) : undefined))
      .filter((t): t is number => t !== undefined);
    if (sourceTtls.length === 0) return this.defaultTtlSeconds;
    return Math.min(...sourceTtls, this.defaultTtlSeconds);
  }

  private invalidatePattern(input: InvalidateInput): string {
    const agent = input.agentId ?? '*';
    const ns = input.namespace ?? '*';
    const ver = input.version ?? '*';
    return `cag:${input.tenantId}:${agent}:${ns}:${ver}:*`;
  }

  private assertTenant(tenantId: string | undefined): void {
    if (this.multiTenant && (!tenantId || tenantId.trim() === '')) {
      throw CagError.tenantRequired();
    }
  }

  private emit(event: string, payload: unknown): void {
    this.localEmitter.emit(event, payload);
    this.externalEmitter?.emit(event, payload);
  }
}
