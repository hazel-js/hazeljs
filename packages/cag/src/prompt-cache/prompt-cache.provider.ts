import type { PreparedContext, PromptCacheProvider, ProviderCachedContext } from '../types';
import { sha256 } from '../fingerprint/context-fingerprint';

/**
 * Default prompt-cache hint builder. Does not call vendor APIs —
 * returns opaque keys / breakpoints for @hazeljs/ai consumers.
 */
export class DefaultPromptCacheProvider implements PromptCacheProvider {
  constructor(private readonly provider: ProviderCachedContext['provider'] = 'custom') {}

  async prepare(context: PreparedContext): Promise<ProviderCachedContext> {
    const cacheKey = `pc:${this.provider}:${context.fingerprint}`;
    const breakpoints =
      this.provider === 'anthropic'
        ? [Math.min(context.text.length, Math.floor(context.text.length * 0.9))]
        : undefined;

    return {
      provider: this.provider,
      cacheKey,
      breakpoints,
      cachedContent: this.provider === 'gemini' ? cacheKey : undefined,
      metadata: {
        namespace: context.namespace,
        tenantId: context.tenantId,
        tokenCount: context.tokenCount,
        contentHash: sha256(context.text).slice(0, 16),
      },
    };
  }
}
