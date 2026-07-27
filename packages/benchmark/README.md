# @hazeljs/benchmark

Benchmark helpers for HazelJS Agent OS. Run comparable case sets, summarize run quality, and compare candidate performance against a baseline.

[![npm version](https://img.shields.io/npm/v/@hazeljs/benchmark.svg)](https://www.npmjs.com/package/@hazeljs/benchmark)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Installation

```bash
npm install @hazeljs/benchmark
```

## Features

- **Run benchmark suites** — Execute async cases with `runBenchmark`
- **Aggregate run stats** — Compute average score, duration, and pass rate
- **Detect regressions** — Compare baseline vs candidate with configurable threshold
- **CI-friendly output shape** — Plain objects that are easy to serialize or gate on

## Quick Start

```typescript
import { runBenchmark, summarizeBenchmarkRun, compareBenchmarkRuns } from '@hazeljs/benchmark';

const baseline = summarizeBenchmarkRun('baseline', [
  { id: 'refund', score: 0.9, durationMs: 300, passed: true },
  { id: 'shipping', score: 0.8, durationMs: 220, passed: true },
]);

const candidate = await runBenchmark({
  label: 'candidate',
  commit: process.env.GIT_SHA,
  cases: [
    { id: 'refund', input: 'I want a refund' },
    { id: 'shipping', input: 'Where is my package?' },
  ],
  run: async (input, id) => {
    const result = await myAgentRunner(input);
    return {
      score: result.score,
      durationMs: result.durationMs,
      passed: result.score >= 0.7,
      costUsd: result.costUsd,
      error: result.error,
    };
  },
});

const comparison = compareBenchmarkRuns(baseline, candidate, 0.05);
if (comparison.regressions.length > 0) {
  console.log('Regressions found:', comparison.regressions);
  process.exitCode = 1;
}
```

## API

- `runBenchmark(opts)`
- `summarizeBenchmarkRun(label, cases, commit?)`
- `compareBenchmarkRuns(baseline, candidate, regressionThreshold?)`

## Scripts

- `npm run build` — Compile TypeScript to `dist/`
- `npm test` — Run Jest tests with coverage
- `npm run clean` — Remove `dist/`

## License

Apache-2.0

## Links

- [HazelJS documentation](https://hazeljs.ai)
- [Monorepo source](https://github.com/hazel-js/hazeljs) — `packages/benchmark`
