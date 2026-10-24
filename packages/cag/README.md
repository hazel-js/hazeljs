# @hazeljs/cag

**Prepare once. Reuse on every request.**

Cache-Augmented Generation for HazelJS — fingerprint, cache, and reuse **stable** context (policies, catalogs, schemas, tenant config) without embedding + search on every turn.

CAG is **not** a RAG wrapper. Optional RAG loaders can supply file/URL sources; vector search stays in `@hazeljs/rag`. Store concepts reuse `@hazeljs/cache` via `CagStore`.

[![npm version](https://img.shields.io/npm/v/@hazeljs/cag.svg)](https://www.npmjs.com/package/@hazeljs/cag)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/cag)](https://www.npmjs.com/package/@hazeljs/cag)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## CAG vs RAG

|              | CAG                                        | RAG                                 |
| ------------ | ------------------------------------------ | ----------------------------------- |
| Question     | What context can I preload/reuse?          | What information should I retrieve? |
| Typical data | Policies, catalogs, schemas, tenant config | Documents matched to a query        |
| Hot path     | Cache hit → assemble → LLM                 | Embed → search → passages → LLM     |

## Features

- **Prepared context cache** — sources → load → fingerprint → store → hit on the hot path
- **Multi-tenant by default** — cache keys always include `tenantId`
- **Token budgets** — `truncate` | `priority` | `compress` | `summarize` | `reject`
- **Safe compression** — `compressible: false` or `priority >= 90` never rewritten
- **Invalidation** — TTL, version change, or `cag.invalidate({ tenantId, namespace })`
- **Prompt-cache hints** — opaque OpenAI / Anthropic / Gemini hints for `@hazeljs/ai` (no vendor SDK lock-in)
- **Agent OS port** — inject as `AgentRuntimeConfig.cagService`; DNA may declare `context.cag.enabled`

## Installation

```bash
npm install @hazeljs/cag @hazeljs/core @hazeljs/cache
```

## Quick Start

```typescript
import { CagModule, CagService } from '@hazeljs/cag';

@Module({
  imports: [
    CagModule.forRoot({
      store: 'memory',
      ttl: '1h',
      maxTokens: 50_000,
      compression: true,
      invalidation: { strategy: 'version' },
      multiTenant: true,
    }),
  ],
})
export class AppModule {}

@Injectable()
export class SupportAgent {
  constructor(private readonly cag: CagService) {
    this.cag.register(
      {
        id: 'return-policy',
        priority: 100,
        compressible: false,
        version: '2026-10',
        source: { type: 'text', content: 'Returns within 30 days…' },
      },
      'support'
    );
  }

  async answer(question: string, tenantId: string) {
    const { context, hit } = await this.cag.getContext({
      namespace: 'support',
      tenantId,
    });
    return { context: context.text, hit };
  }
}
```

## Context Sources

Imperative: `text`, `json`, `file`, `url`, `function`, `rag`, `memory`, `custom`.

Declarative:

```typescript
@ContextSource({ namespace: 'merchant-policy', ttl: '6h', priority: 100 })
export class MerchantPolicyContext {
  async load(input: ContextLoadInput) {
    return loadMerchantPolicies(input.tenantId);
  }
}
```

## Caching & Invalidation

- Memory store by default; Redis via injected `redis.client` (ioredis-compatible)
- Keys: `cag:{tenant}:{agent}:{namespace}:{version}:{fingerprint}` plus a stable lookup key
- Invalidate: TTL, version change, `cag.invalidate({ tenantId, namespace })`

## Token Budgets & Compression

```typescript
tokenBudget: { max: 50_000, strategy: 'priority' } // truncate | priority | compress | summarize | reject
```

Compression is optional. Sources with `compressible: false` or `priority >= 90` are never rewritten.

## Multi-Tenancy

`multiTenant` defaults to **true**. Cache keys always include `tenantId`. Tenant A cannot read Tenant B context.

## LLM Provider Caching

`PromptCacheProvider.prepare()` returns opaque hints for OpenAI / Anthropic / Gemini. Pass them on `@hazeljs/ai` `AICompletionRequest.promptCache`. CAG does not call vendor SDKs.

## Observability

Events: `cag.context.hit|miss|build|invalidate|compress`. Metrics via `cag.getMetrics()`.

## Agent Integration

Inject `CagService` as `AgentRuntimeConfig.cagService`. DNA may declare `context.cag.enabled`.

## Production Guide

- Prefer Redis with a real client in production
- Set `strict: true` to fail closed on store errors
- Keep compliance text at priority ≥ 90 and `compressible: false`
- Scope every key by tenant; add tests for isolation

## Related

- Docs: [hazeljs.ai/docs/packages/cag](https://hazeljs.ai/docs/packages/cag)
- Blog: [RAG vs CAG vs KAG](https://hazeljs.ai/blog/rag-vs-cag-vs-kag)
- Lab: [meridian-ops `example:cag`](https://github.com/hazel-js/hazeljs-meridian-ops/tree/main/examples/cag-support-agent)
- `@hazeljs/rag` — query-time retrieval
- `@hazeljs/kag` — structured knowledge
- `@hazeljs/context` — unified planner

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
