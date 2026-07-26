import {
  describeAgent,
  runAgentSuite,
  clearRegisteredSuites,
  getRegisteredSuites,
} from './describe-agent';
import { assertAgentResult, expectTools, expectMaxLatency, expectMaxCost } from './assertions';

describe('@hazeljs/testing', () => {
  beforeEach(() => {
    clearRegisteredSuites();
  });

  it('describeAgent collects tests', () => {
    const suite = describeAgent('Support Agent', ({ test }) => {
      test('Refund', async () => undefined);
      test('Shipping Delay', async () => undefined);
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

  it('assertAgentResult checks tools and cost', () => {
    expect(() =>
      assertAgentResult(
        { output: 'ok', durationMs: 5, toolCalls: ['a'], costUsd: 0.01 },
        { expectedTools: ['a'], maxCostUsd: 0.02, outputIncludes: 'ok' }
      )
    ).not.toThrow();

    expect(() =>
      expectTools({ output: '', durationMs: 0, toolCalls: ['x'] }, ['y'])
    ).toThrow(/Tool trajectory/);

    expect(() => expectMaxCost({ output: '', durationMs: 0, costUsd: 1 }, 0.1)).toThrow(/Cost/);
  });
});
