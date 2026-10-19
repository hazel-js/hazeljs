/**
 * Non-CI microbench for CAG. Prints timings only — not product claims.
 */
import { CagService } from './cag.service';
import { MemoryCagStore } from './stores/memory-cag.store';

async function main(): Promise<void> {
  const service = new CagService(
    { multiTenant: true, ttl: 3600, maxTokens: 50_000 },
    new MemoryCagStore()
  );
  const big = 'Policy line. '.repeat(2000);
  service.register(
    { id: 'policy', priority: 100, version: '1', source: { type: 'text', content: big } },
    'bench'
  );

  const t0 = Date.now();
  const miss = await service.getContext({ namespace: 'bench', tenantId: 't1' });
  const missMs = Date.now() - t0;

  const t1 = Date.now();
  const hit = await service.getContext({ namespace: 'bench', tenantId: 't1' });
  const hitMs = Date.now() - t1;

  const metrics = service.getMetrics();
  console.log(
    JSON.stringify(
      {
        uncachedLatencyMs: missMs,
        cachedLatencyMs: hitMs,
        hit: hit.hit,
        missHit: miss.hit,
        tokenCount: miss.context.tokenCount,
        tokensSaved: metrics.tokensSaved,
        hitRatio: metrics.hitRatio,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
