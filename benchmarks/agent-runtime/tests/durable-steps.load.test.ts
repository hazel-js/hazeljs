/**
 * Load durable-step benches — 100 / 1000 / concurrent file-store pressure.
 * No LLM, no network. Same createDurableRunStore path as hazeld.
 */
import { recordScenario } from './report';
import { appendBenchmark, measureConcurrentDurable, measureDurableSteps } from './bench-utils';

describe('durable step benchmark (load)', () => {
  it('measures 100 sequential 1KiB checkpoint steps × 5 runs', async () => {
    const bench = await measureDurableSteps({
      name: 'durable-steps-100',
      steps: 100,
      measuredRuns: 5,
      warmupRuns: 1,
    });
    appendBenchmark(bench);

    recordScenario({
      id: 'BENCH-durable-steps-100',
      title: 'measures 100 sequential 1KiB checkpoint steps × 5 runs',
      status: 'pass',
      steps: [
        'Warmup 1 run discarded; 5 measured runs × 100 checkpoints',
        `wall=${bench.wallMs.toFixed(1)}ms throughput=${bench.stepsPerSec.toFixed(0)} steps/s`,
        `p50=${bench.stepP50Ms.toFixed(3)}ms p95=${bench.stepP95Ms.toFixed(3)}ms p99=${bench.stepP99Ms.toFixed(3)}ms`,
      ],
      observations: { ...bench },
      claim: 'Load signal for file durable checkpoint overhead — not an SLA.',
    });

    expect(bench.measuredRuns).toBe(5);
  }, 120_000);

  it('measures 1000 sequential 1KiB checkpoint steps × 3 runs', async () => {
    const bench = await measureDurableSteps({
      name: 'durable-steps-1000',
      steps: 1000,
      measuredRuns: 3,
      warmupRuns: 1,
    });
    appendBenchmark(bench);

    recordScenario({
      id: 'BENCH-durable-steps-1000',
      title: 'measures 1000 sequential 1KiB checkpoint steps × 3 runs',
      status: 'pass',
      steps: [
        'Warmup 1 run discarded; 3 measured runs × 1000 checkpoints',
        `wall=${bench.wallMs.toFixed(1)}ms throughput=${bench.stepsPerSec.toFixed(0)} steps/s`,
        `p50=${bench.stepP50Ms.toFixed(3)}ms p95=${bench.stepP95Ms.toFixed(3)}ms p99=${bench.stepP99Ms.toFixed(3)}ms`,
      ],
      observations: { ...bench },
      claim: 'Heavier durable-store load — not an SLA.',
    });

    expect(bench.steps).toBe(1000);
  }, 180_000);

  it('measures 20 parallel runs × 50 checkpoints (concurrent file store)', async () => {
    const bench = await measureConcurrentDurable({
      name: 'durable-steps-concurrent-20x50',
      parallelRuns: 20,
      stepsPerRun: 50,
    });
    appendBenchmark(bench);

    recordScenario({
      id: 'BENCH-durable-steps-concurrent',
      title: 'measures 20 parallel runs × 50 checkpoints (concurrent file store)',
      status: 'pass',
      steps: [
        '20 concurrent durable runs × 50 × 1KiB checkpoints',
        `wall=${bench.wallMs.toFixed(1)}ms throughput=${bench.stepsPerSec.toFixed(0)} steps/s`,
        `p50=${bench.stepP50Ms.toFixed(3)}ms p95=${bench.stepP95Ms.toFixed(3)}ms p99=${bench.stepP99Ms.toFixed(3)}ms`,
      ],
      observations: { ...bench },
      claim: 'Concurrent file-store pressure — not an SLA.',
    });

    expect(bench.parallelRuns).toBe(20);
  }, 180_000);
});
