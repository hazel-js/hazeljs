# @hazeljs/testing

Agent testing DSL for HazelJS Agent OS. Define reusable suites with `describeAgent`, run assertions on latency/cost/tool trajectories, and gate golden datasets in CI.

[![npm version](https://img.shields.io/npm/v/@hazeljs/testing.svg)](https://www.npmjs.com/package/@hazeljs/testing)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Installation

```bash
npm install @hazeljs/testing @hazeljs/eval
```

Optional peer dependency (for runtime-backed suites):

```bash
npm install @hazeljs/agent
```

## Features

- **Suite DSL** — `describeAgent` with `test` / `it` helpers
- **Runtime assertions** — `assertAgentResult`, `expectTools`, `expectMaxLatency`, `expectMaxCost`
- **Execution modes** — `runAgentSuite` for single-test execution or `bindAgentSuite` for native Jest/Vitest expansion
- **Golden dataset support** — `runAgentGolden` on top of `@hazeljs/eval`
- **CI reporting** — `reportAgentCi(result, { exitOnFail: true })`

## Quick Start

```typescript
import { describeAgent, runAgentSuite, assertAgentResult, expectTools } from '@hazeljs/testing';

const suite = describeAgent(
  'Support Agent',
  ({ test }) => {
    test('Refund flow', async ({ run }) => {
      const result = await run('I want a refund for order 123');
      expectTools(result, ['lookup-order']);
      assertAgentResult(result, {
        maxLatencyMs: 5000,
        maxCostUsd: 0.05,
        outputIncludes: 'refund',
      });
    });
  },
  { failFast: true }
);

const outcome = await runAgentSuite(suite, {
  agentName: 'support-agent',
  run: async (input) => {
    const execution = await runtime.execute('support-agent', input);
    return {
      output: execution.response ?? '',
      durationMs: execution.duration,
      toolCalls: execution.steps.filter((s) => s.action?.toolName).map((s) => s.action!.toolName!),
    };
  },
});

expect(outcome.failed).toBe(0);
```

## Golden Datasets + CI

```typescript
import { runAgentGolden, reportAgentCi } from '@hazeljs/testing';

const result = await runAgentGolden(dataset, ctx, {
  maxLatencyMs: 8000,
  maxCostUsd: 0.1,
  minAverageScore: 0.8,
});

reportAgentCi(result, { exitOnFail: true });
```

## Jest / Vitest Integration

Use `bindAgentSuite(suite, () => ctx)` to expand suite cases into native `it(...)` blocks. Use `runAgentSuite(...)` when you prefer a single integration-style test per suite.

## Scripts

- `npm run build` — Compile TypeScript to `dist/`
- `npm test` — Run Jest tests with coverage thresholds
- `npm run test:ci` — Emit text + lcov coverage reports without threshold enforcement
- `npm run lint` — Lint `src/**/*.ts`
- `npm run lint:fix` — Auto-fix lint issues
- `npm run clean` — Remove `dist/`

## License

Apache-2.0

## Links

- [HazelJS documentation](https://hazeljs.ai)
- [Monorepo source](https://github.com/hazel-js/hazeljs) — `packages/testing`
