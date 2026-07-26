# @hazeljs/testing

Agent OS testing DSL for HazelJS — `describeAgent` on top of [`@hazeljs/eval`](../eval).

## Install

```bash
npm install @hazeljs/testing @hazeljs/eval
```

## Usage

```ts
import {
  describeAgent,
  runAgentSuite,
  assertAgentResult,
  expectTools,
} from '@hazeljs/testing';

const suite = describeAgent('Support Agent', ({ test }) => {
  test('Refund', async ({ run }) => {
    const result = await run('I want a refund for order 123');
    expectTools(result, ['lookup-order']);
    assertAgentResult(result, {
      maxLatencyMs: 5000,
      maxCostUsd: 0.05,
      outputIncludes: 'refund',
    });
  });

  test('Shipping Delay', async ({ run }) => {
    const result = await run('Where is my package?');
    assertAgentResult(result, { maxLatencyMs: 5000 });
  });
});

it('support agent regression', async () => {
  const { failed, errors } = await runAgentSuite(suite, {
    agentName: 'support-agent',
    run: async (input) => {
      const out = await runtime.execute('support-agent', input);
      return {
        output: out.response ?? '',
        durationMs: out.duration,
        toolCalls: out.steps
          .filter((s) => s.action?.toolName)
          .map((s) => s.action!.toolName!),
      };
    },
  });
  expect(failed).toBe(0);
  expect(errors).toEqual([]);
});
```

## CI helpers

```ts
import { runAgentGolden, reportAgentCi } from '@hazeljs/testing';

const result = await runAgentGolden(dataset, ctx, {
  maxLatencyMs: 8000,
  maxCostUsd: 0.1,
  minAverageScore: 0.8,
});
reportAgentCi(result, { failOnScoreBelow: 0.8 });
```

## Jest / Vitest

Use `bindAgentSuite(suite, () => ctx)` to expand each case into a native `it()`, or call `runAgentSuite` inside a single test as shown above.
