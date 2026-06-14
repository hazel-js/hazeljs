/**
 * Pluggable store for tool approval requests (supports multi-instance deployments).
 */

import { ToolApprovalRequest } from '../types/tool.types';

export interface IApprovalStore {
  create(request: ToolApprovalRequest): Promise<void> | void;
  get(
    requestId: string
  ): Promise<ToolApprovalRequest | undefined> | ToolApprovalRequest | undefined;
  listPending(): Promise<ToolApprovalRequest[]> | ToolApprovalRequest[];
  approve(requestId: string, approvedBy: string): Promise<boolean> | boolean;
  reject(requestId: string): Promise<boolean> | boolean;
  delete(requestId: string): Promise<void> | void;
}

export interface ApprovalWaitOptions {
  requestId: string;
  expiresAt: Date;
  pollIntervalMs?: number;
}
