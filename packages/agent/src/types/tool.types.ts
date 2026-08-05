/**
 * Tool System Types
 */

import { z } from 'zod';

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
export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolConfig {
  name: string;
  description: string;
  /** Legacy manual parameter definitions */
  parameters?: ToolParameter[];
  /** Modern Zod schema for strongly-typed input validation */
  schema?: z.ZodTypeAny;
  requiresApproval?: boolean;
  timeout?: number;
  retries?: number;
  policy?: string;
  metadata?: Record<string, unknown>;
  /** Capability / skill namespace (e.g. payments.write) — AOS-007 / Skillgate */
  capability?: string;
  /** Relative risk for policy / approval defaults */
  riskLevel?: ToolRiskLevel;
  /** True when the tool has no side effects */
  readOnly?: boolean;
  /** Safe to retry with the same input */
  idempotent?: boolean;
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
  /** Set when durableSuspend returns without awaiting approval (AOS-006). */
  pendingApproval?: boolean;
  requestId?: string;
}

/**
 * Tool approval request status
 */
export type ToolApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

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
  /** Set when approval flow completes. */
  status: ToolApprovalStatus;
  /** Set when status is 'approved'. */
  approvedBy?: string;
  approvedAt?: Date;
  /** Set when status is 'rejected'. */
  rejectedAt?: Date;
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
