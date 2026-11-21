/**
 * Smoke durable-step bench — kept tiny for CI / test:smoke.
 */
import { recordScenario } from './report';
import { appendBenchmark, measureDurableSteps } from './bench-utils';

describe('durable step benchmark (smoke)', () => {
  it('measures 10 sequential 1KiB checkpoint steps', async () => {
    const bench = await measureDurableSteps({
      name: 'durable-steps-10',
      steps: 10,
      measuredRuns: 1,
    });
    appendBenchmark(bench);

    recordScenario({
      id: 'BENCH-durable-steps-10',
      title: 'measures 10 sequential 1KiB checkpoint steps',
      status: 'pass',
      steps: [
        'File durable store — 10 sequential 1KiB checkpoints (smoke)',
        `p50=${bench.stepP50Ms.toFixed(3)}ms p95=${bench.stepP95Ms.toFixed(3)}ms throughput=${bench.stepsPerSec.toFixed(0)} steps/s`,
      ],
      observations: { ...bench },
      claim: 'Smoke measurement only — use test:bench / load suite for 100/1000.',
    });

    expect(bench.steps).toBe(10);
  });
});
