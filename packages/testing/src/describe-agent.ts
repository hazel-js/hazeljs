import type { AgentTestContext, AgentTestFn, DescribeAgentOptions, RegisteredSuite } from './types';

const suites: RegisteredSuite[] = [];

export interface DescribeAgentHelpers {
  test: (name: string, fn: AgentTestFn) => void;
  it: (name: string, fn: AgentTestFn) => void;
}

/**
 * Register an agent test suite.
 *
 * @example
 * ```ts
 * const suite = describeAgent('Support Agent', ({ test }) => {
 *   test('Refund', async ({ run }) => {
 *     const r = await run('I want a refund');
 *     expectTools(r, ['lookup-order']);
 *   });
 * });
 *
 * it('support agent suite', async () => {
 *   const result = await runAgentSuite(suite, { agentName: 'support-agent', run });
 *   expect(result.failed).toBe(0);
 * });
 * ```
 */
export function describeAgent(
  name: string,
  define: (helpers: DescribeAgentHelpers) => void,
  options: DescribeAgentOptions = {}
): RegisteredSuite {
  const suite: RegisteredSuite = { name, options, tests: [] };

  const register = (testName: string, testBody: AgentTestFn): void => {
    suite.tests.push({ name: testName, fn: testBody });
  };

  define({ test: register, it: register });
  suites.push(suite);
  return suite;
}

/**
 * Bind a suite into Jest/Vitest `describe`/`it` with a shared context factory.
 */
export function bindAgentSuite(
  suite: RegisteredSuite,
  createContext: () => AgentTestContext | Promise<AgentTestContext>
): void {
  const describeGlobal = (globalThis as unknown as { describe?: (n: string, f: () => void) => void })
    .describe;
  const itGlobal = (
    globalThis as unknown as { it?: (n: string, f: () => void | Promise<void>) => void }
  ).it;
  if (!describeGlobal || !itGlobal) {
    throw new Error('bindAgentSuite requires Jest or Vitest globals (describe/it)');
  }

  describeGlobal(`describeAgent(${suite.name})`, () => {
    for (const t of suite.tests) {
      itGlobal(t.name, async () => {
        const ctx = await createContext();
        await t.fn(ctx);
      });
    }
  });
}

export function getRegisteredSuites(): RegisteredSuite[] {
  return [...suites];
}

export function clearRegisteredSuites(): void {
  suites.length = 0;
}

/**
 * Execute a suite with a concrete agent runner context.
 */
export async function runAgentSuite(
  suite: RegisteredSuite,
  ctx: AgentTestContext
): Promise<{ passed: number; failed: number; errors: Error[] }> {
  let passed = 0;
  let failed = 0;
  const errors: Error[] = [];

  const wrappedCtx: AgentTestContext = {
    ...ctx,
    run: async (input) => {
      const result = await ctx.run(input);
      if (suite.options.maxLatencyMs != null) {
        const { expectMaxLatency } = await import('./assertions');
        expectMaxLatency(result, suite.options.maxLatencyMs);
      }
      if (suite.options.maxCostUsd != null) {
        const { expectMaxCost } = await import('./assertions');
        expectMaxCost(result, suite.options.maxCostUsd);
      }
      return result;
    },
  };

  for (const t of suite.tests) {
    try {
      await t.fn(wrappedCtx);
      passed++;
    } catch (e) {
      failed++;
      errors.push(e instanceof Error ? e : new Error(String(e)));
      if (suite.options.failFast !== false) break;
    }
  }

  return { passed, failed, errors };
}
