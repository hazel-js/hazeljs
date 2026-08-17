/**
 * Pluggable authorization gate for tool execution (e.g. @hazeljs/agent-gatekeeper).
 * When set, ToolExecutor delegates to this gate and skips PolicyService/PolicyEngine.
 */

import type { ToolExecutionResult, ToolMetadata } from '../types/tool.types';

export interface ToolAuthorizationGateExecuteInput {
  tool: ToolMetadata;
  input: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  userId?: string;
  runId?: string;
}

export interface ToolAuthorizationGate {
  execute(input: ToolAuthorizationGateExecuteInput): Promise<ToolExecutionResult>;
}
