/**
 * Recovery - pick up RUNNING flows on startup
 */
import pLimit from 'p-limit';
import type { FlowEngine } from '@hazeljs/flow';

const CONCURRENCY = 5;

export async function recovery(engine: FlowEngine): Promise<void> {
  const runIds = await engine.getRunningRunIds();

  const limit = pLimit(CONCURRENCY);
  await Promise.all(
    runIds.map((runId) =>
      limit(async () => {
        try {
          await engine.tick(runId);
        } catch (err) {
          // eslint-disable-next-line no-console -- recovery error reporting
          console.error(`Recovery failed for run ${runId}:`, err);
        }
      })
    )
  );
}
