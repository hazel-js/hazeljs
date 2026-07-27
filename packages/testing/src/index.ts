/**
 * @hazeljs/testing — Agent OS testing DSL
 */

export type {
  AgentTestContext,
  AgentTestFn,
  DescribeAgentOptions,
  AgentAssertOptions,
  AgentRunResult,
} from './types';

export {
  describeAgent,
  bindAgentSuite,
  getRegisteredSuites,
  clearRegisteredSuites,
  runAgentSuite,
} from './describe-agent';
export { assertAgentResult, expectTools, expectMaxCost, expectMaxLatency } from './assertions';
export { runAgentGolden, reportAgentCi } from './ci';
