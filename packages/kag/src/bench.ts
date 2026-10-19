/**
 * Non-CI microbench for KAG. Prints timings only — not product claims.
 */
import { KnowledgeGraph } from './knowledge-graph';

async function main(): Promise<void> {
  const graph = new KnowledgeGraph({ tenantId: 'bench', graph: 'g' });
  const n = 500;
  const tIngest = Date.now();
  for (let i = 0; i < n; i++) {
    await graph.entity({
      id: `e-${i}`,
      type: 'node',
      properties: { name: `Entity ${i}` },
    });
    if (i > 0) {
      await graph.relate({
        from: `e-${i - 1}`,
        to: `e-${i}`,
        type: 'NEXT',
      });
    }
  }
  const ingestMs = Date.now() - tIngest;

  const tTrav = Date.now();
  await graph.traverse(['e-0'], { depth: 3 });
  const traverseMs = Date.now() - tTrav;

  const tAsk = Date.now();
  await graph.ask('Entity 10 NEXT path', { explain: true });
  const askMs = Date.now() - tAsk;

  console.log(
    JSON.stringify(
      {
        entityCount: n,
        relationIngestApprox: n - 1,
        ingestMs,
        entitiesPerSec: Math.round((n / ingestMs) * 1000),
        traverseMs,
        askMs,
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
