/**
 * @hazeljs/ops-agent
 * Ops agent for Jira, Slack, and DevOps workflows
 */

export { OpsAgent } from './ops-agent';
export { createOpsRuntime, runOpsAgent } from './create-ops-runtime';
export { createJiraTool } from './adapters/jira';
export { createSlackTool } from './adapters/slack';
export type {
  JiraToolLike,
  SlackToolLike,
  OpsAgentToolsConfig,
  CreateOpsRuntimeOptions,
  AIServiceAdapter,
} from './types';
export type { JiraConfig } from './adapters/jira';
export type { SlackConfig } from './adapters/slack';
