/**
 * Tool System Types
 */

/**
 * Tool execution status
 */
export enum ToolExecutionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Tool configuration
 */
export interface ToolConfig {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  requiresApproval?: boolean;
  timeout?: number;
  retries?: number;
  policy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  validation?: (value: unknown) => boolean;
}

/**
 * Tool metadata stored via decorator
 */
export interface ToolMetadata extends ToolConfig {
  target: object;
  propertyKey: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  method: Function;
  agentClass?: new (...args: unknown[]) => unknown;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  executionId: string;
  toolName: string;
  agentId: string;
  sessionId: string;
  userId?: string;
  input: Record<string, unknown>;
  status: ToolExecutionStatus;
  approvedBy?: string;
  approvedAt?: Date;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
  duration: number;
}

/**
 * Tool approval request
 */
export interface ToolApprovalRequest {
  requestId: string;
  executionId: string;
  toolName: string;
  agentId: string;
  input: Record<string, unknown>;
  reason?: string;
  requestedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Tool approval response
 */
export interface ToolApprovalResponse {
  requestId: string;
  approved: boolean;
  approvedBy: string;
  reason?: string;
  approvedAt: Date;
  modifications?: Record<string, unknown>;
}

/**
 * Tool definition for LLM
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: unknown[];
      }
    >;
    required: string[];
  };
}
