import {
  describeAgent,
  runAgentSuite,
  clearRegisteredSuites,
  getRegisteredSuites,
  bindAgentSuite,
} from './describe-agent';
import {
  assertAgentResult,
  expectTools,
  expectMaxLatency,
  expectMaxCost,
  AgentAssertionError,
} from './assertions';
import { runAgentGolden, reportAgentCi } from './ci';

describe('@hazeljs/testing', () => {
  beforeEach(() => {
    clearRegisteredSuites();
  });

  it('describeAgent collects tests via test and it helpers', () => {
    const suite = describeAgent('Support Agent', ({ test, it }) => {
      test('Refund', async () => undefined);
      it('Shipping Delay', async () => undefined);
    });
    expect(suite.name).toBe('Support Agent');
    expect(suite.tests).toHaveLength(2);
    expect(getRegisteredSuites()).toHaveLength(1);
  });

  it('runAgentSuite executes tests with context', async () => {
    const suite = describeAgent('Echo', ({ test }) => {
      test('hello', async ({ run }) => {
        const r = await run('hi');
        expect(r.output).toBe('echo:hi');
        expectMaxLatency(r, 1000);
      });
    });

    const result = await runAgentSuite(suite, {
      agentName: 'echo',
      run: async (input) => ({
        output: `echo:${input}`,
        durationMs: 10,
        toolCalls: [],
      }),
    });
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('runAgentSuite enforces suite latency and cost options', async () => {
    const suite = describeAgent(
      'Gated',
      ({ test }) => {
        test('slow', async ({ run }) => {
          await run('x');
        });
      },
      { maxLatencyMs: 5, maxCostUsd: 0.01 }
    );

    const slow = await runAgentSuite(suite, {
      agentName: 'gated',
      run: async () => ({ output: 'ok', durationMs: 50, costUsd: 0.001 }),
    });
    expect(slow.failed).toBe(1);
    expect(slow.errors[0]).toBeInstanceOf(AgentAssertionError);

    const costly = await runAgentSuite(
      describeAgent(
        'Costly',
        ({ test }) => {
          test('expensive', async ({ run }) => {
            await run('x');
          });
        },
        { maxCostUsd: 0.01 }
      ),
      {
        agentName: 'costly',
        run: async () => ({ output: 'ok', durationMs: 1, costUsd: 1 }),
      }
    );
    expect(costly.failed).toBe(1);
  });

  it('runAgentSuite failFast stops after first failure and continues when disabled', async () => {
    const failFast = describeAgent(
      'FailFast',
      ({ test }) => {
        test('a', async () => {
          throw new Error('first');
        });
        test('b', async () => undefined);
      },
      { failFast: true }
    );
    const stopped = await runAgentSuite(failFast, {
      agentName: 'ff',
      run: async () => ({ output: '', durationMs: 0 }),
    });
    expect(stopped.passed).toBe(0);
    expect(stopped.failed).toBe(1);

    const continueAll = describeAgent(
      'Continue',
      ({ test }) => {
        test('a', async () => {
          throw 'string-error';
        });
        test('b', async () => undefined);
      },
      { failFast: false }
    );
    const all = await runAgentSuite(continueAll, {
      agentName: 'c',
      run: async () => ({ output: '', durationMs: 0 }),
    });
    expect(all.passed).toBe(1);
    expect(all.failed).toBe(1);
    expect(all.errors[0].message).toBe('string-error');
  });

  it('bindAgentSuite wires Jest globals', async () => {
    const suite = describeAgent('Bound', ({ test }) => {
      test('case', async ({ run }) => {
        const r = await run('in');
        expect(r.output).toBe('out');
      });
    });

    const registered: Array<{ name: string; fn: () => Promise<void> }> = [];
    const prevDescribe = (globalThis as { describe?: unknown }).describe;
    const prevIt = (globalThis as { it?: unknown }).it;
    (globalThis as { describe: typeof describe }).describe = ((name, fn) => {
      expect(name).toContain('Bound');
      fn();
    }) as typeof describe;
    (globalThis as { it: typeof it }).it = ((name, fn) => {
      registered.push({ name, fn: fn as () => Promise<void> });
    }) as typeof it;

    try {
      bindAgentSuite(suite, async () => ({
        agentName: 'bound',
        run: async () => ({ output: 'out', durationMs: 1 }),
      }));
      expect(registered).toHaveLength(1);
      await registered[0].fn();
    } finally {
      (globalThis as { describe?: unknown }).describe = prevDescribe;
      (globalThis as { it?: unknown }).it = prevIt;
    }
  });

  it('bindAgentSuite throws without describe/it globals', () => {
    const suite = describeAgent('NoGlobals', ({ test }) => {
      test('x', async () => undefined);
    });
    const prevDescribe = (globalThis as { describe?: unknown }).describe;
    const prevIt = (globalThis as { it?: unknown }).it;
    delete (globalThis as { describe?: unknown }).describe;
    delete (globalThis as { it?: unknown }).it;
    try {
      expect(() =>
        bindAgentSuite(suite, () => ({
          agentName: 'x',
          run: async () => ({ output: '', durationMs: 0 }),
        }))
      ).toThrow(/requires Jest or Vitest/);
    } finally {
      (globalThis as { describe?: unknown }).describe = prevDescribe;
      (globalThis as { it?: unknown }).it = prevIt;
    }
  });

  it('assertAgentResult checks tools, latency, cost, and output', () => {
    expect(() =>
      assertAgentResult(
        { output: 'ok', durationMs: 5, toolCalls: ['a'], costUsd: 0.01 },
        { expectedTools: ['a'], maxCostUsd: 0.02, maxLatencyMs: 10, outputIncludes: 'ok' }
      )
    ).not.toThrow();

    expect(() => expectTools({ output: '', durationMs: 0, toolCalls: ['x'] }, ['y'])).toThrow(
      /Tool trajectory/
    );
    expect(() => expectTools({ output: '', durationMs: 0 }, ['y'])).toThrow(/Tool trajectory/);

    expect(() => expectMaxCost({ output: '', durationMs: 0, costUsd: 1 }, 0.1)).toThrow(/Cost/);
    expect(() => expectMaxCost({ output: '', durationMs: 0 }, 0.1)).not.toThrow();

    expect(() => expectMaxLatency({ output: '', durationMs: 50 }, 10)).toThrow(/Latency/);

    expect(() =>
      assertAgentResult({ output: 'hello', durationMs: 1 }, { outputIncludes: 'missing' })
    ).toThrow(/Output does not include/);

    expect(() =>
      assertAgentResult({ output: 'ok', durationMs: 100 }, { maxLatencyMs: 10 })
    ).toThrow(/Latency/);
  });

  it('runAgentGolden and reportAgentCi integrate with @hazeljs/eval', async () => {
    const result = await runAgentGolden(
      {
        name: 'support',
        version: '1',
        cases: [
          { id: '1', input: 'refund', expectedOutput: 'refund' },
          { id: '2', input: 'ship', expectedOutput: 'ship' },
        ],
      },
      {
        agentName: 'support',
        run: async (input) => ({
          output: `handled ${input}`,
          durationMs: 2,
          toolCalls: ['lookup'],
          costUsd: 0.001,
        }),
      },
      { maxLatencyMs: 100, maxCostUsd: 1, minAverageScore: 0.5 }
    );
    expect(result.caseResults).toHaveLength(2);
    expect(result.passed).toBe(true);

    const ungated = await runAgentGolden(
      {
        name: 'plain',
        version: '1',
        cases: [{ id: '1', input: 'x' }],
      },
      {
        agentName: 'plain',
        run: async () => ({ output: 'x', durationMs: 1, toolCalls: [] }),
      }
    );
    expect(ungated.passed).toBe(true);

    const slow = await runAgentGolden(
      {
        name: 'slow',
        version: '1',
        cases: [{ id: '1', input: 'x' }],
      },
      {
        agentName: 'slow',
        run: async () => ({ output: 'x', durationMs: 999, costUsd: 0 }),
      },
      { maxLatencyMs: 1 }
    );
    expect(slow.passed).toBe(false);
    expect(slow.caseResults[0].error).toMatch(/Latency/);

    const prev = process.exitCode;
    reportAgentCi(
      {
        datasetName: 'd',
        datasetVersion: '1',
        averageScore: 0,
        passed: false,
        caseResults: [{ caseId: '1', passed: false, score: 0, error: 'boom' }],
      },
      { exitOnFail: true }
    );
    expect(process.exitCode).toBe(1);
    process.exitCode = prev;

    reportAgentCi(ungated);
  });
});
