/**
 * End-to-end refund load — HazeldServer + agent.ts + fake-orders HazelApp.
 * Sequential HITL approve cycles with unique idempotency keys.
 */
import { AgentState, ensureHazelHome, hazelHome } from '@hazeljs/agent';
import {
  AGENT_NAME,
  createRefundHazeld,
  refundDna,
  applyRefundEnv,
} from '../app/create-refund-node';
import { createFixture } from './helpers';
import { appendBenchmark, summarizeLatencies } from './bench-utils';
import { recordScenario } from './report';

describe('refund workflow load', () => {
  it('runs 25 sequential approve→refund cycles', async () => {
    const cycles = 25;
    const fx = await createFixture('hz-load');
    ensureHazelHome(hazelHome(fx.home));

    const server = createRefundHazeld({
      home: fx.home,
      durableDir: fx.durableDir,
      socketPath: fx.socketPath,
      workerId: `load-${process.pid}`,
      fakeBaseUrl: fx.fake.baseUrl,
      authHeader: fx.authHeader,
      orderId: fx.orderId,
      amountMinor: fx.amountMinor,
      operationKey: fx.operationKey,
    });

    const latencies: number[] = [];
    try {
      await server.start();
      await server.node.apply(refundDna());

      for (let i = 0; i < cycles; i++) {
        const operationKey = `${fx.operationKey}_c${i}`;
        applyRefundEnv({
          home: fx.home,
          durableDir: fx.durableDir,
          socketPath: fx.socketPath,
          workerId: `load-${process.pid}`,
          fakeBaseUrl: fx.fake.baseUrl,
          authHeader: fx.authHeader,
          orderId: fx.orderId,
          amountMinor: fx.amountMinor,
          operationKey,
        });

        const t0 = process.hrtime.bigint();
        const waiting = await server.node.agentOs.runtime.execute(
          AGENT_NAME,
          `Please refund cycle ${i}`,
          { maxSteps: 8 }
        );
        expect(waiting.state).toBe(AgentState.WAITING_FOR_APPROVAL);
        const done = await server.node.approve(waiting.executionId, 'ops@load');
        expect(done.state).toBe(AgentState.COMPLETED);
        latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }

      expect(fx.fake.stats().refundCount).toBe(cycles);
      const stats = summarizeLatencies(latencies);
      const wallMs = latencies.reduce((a, b) => a + b, 0);
      const bench = {
        name: 'refund-hitl-sequential-25',
        cycles,
        measuredRuns: cycles,
        wallMs,
        cyclesPerSec: wallMs > 0 ? (cycles / wallMs) * 1000 : 0,
        refundCount: fx.fake.stats().refundCount,
        persistence: 'HazeldServer + createDurableRunStore(file) + fake-orders',
        ...stats,
        // alias cycle latencies onto step* keys for report consistency
        cycleP50Ms: stats.stepP50Ms,
        cycleP95Ms: stats.stepP95Ms,
        cycleP99Ms: stats.stepP99Ms,
      };
      appendBenchmark(bench);

      recordScenario({
        id: 'BENCH-refund-load-25',
        title: 'runs 25 sequential approve→refund cycles',
        status: 'pass',
        steps: [
          'HazeldServer + @Agent/@Tool + fake-orders HazelApp',
          `25 unique idempotency keys; refundCount=${cycles}`,
          `wall=${wallMs.toFixed(1)}ms throughput=${bench.cyclesPerSec.toFixed(2)} cycles/s`,
          `cycle p50=${stats.stepP50Ms.toFixed(2)}ms p95=${stats.stepP95Ms.toFixed(2)}ms p99=${stats.stepP99Ms.toFixed(2)}ms`,
        ],
        observations: bench,
        claim: 'Sequential HITL refund load under fake idempotency — not a production SLA.',
      });
    } catch (err) {
      recordScenario({
        id: 'BENCH-refund-load-25',
        title: 'runs 25 sequential approve→refund cycles',
        status: 'fail',
        steps: [`completed ${latencies.length}/${cycles} cycles before failure`],
        observations: {
          refundCount: fx.fake.stats().refundCount,
          completedCycles: latencies.length,
        },
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      await server.stop();
      await fx.cleanup();
    }
  }, 180_000);
});
