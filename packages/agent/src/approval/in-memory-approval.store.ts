import { ToolApprovalRequest } from '../types/tool.types';
import { IApprovalStore } from './approval-store.interface';

/** In-process resolver for a pending approval wait. */
export interface ApprovalResolver {
  resolve: (approved: boolean) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * In-memory approval store (default for development and single-instance deployments).
 */
export class InMemoryApprovalStore implements IApprovalStore {
  private readonly requests = new Map<string, ToolApprovalRequest>();
  readonly resolvers = new Map<string, ApprovalResolver>();

  create(request: ToolApprovalRequest): void {
    this.requests.set(request.requestId, request);
  }

  get(requestId: string): ToolApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  listPending(): ToolApprovalRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.status === 'pending');
  }

  approve(requestId: string, approvedBy: string): boolean {
    const request = this.requests.get(requestId);
    const resolver = this.resolvers.get(requestId);
    if (!request || request.status !== 'pending' || !resolver) {
      return false;
    }
    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    if (resolver.timeoutId) clearTimeout(resolver.timeoutId);
    this.resolvers.delete(requestId);
    this.requests.delete(requestId);
    resolver.resolve(true);
    return true;
  }

  reject(requestId: string): boolean {
    const request = this.requests.get(requestId);
    const resolver = this.resolvers.get(requestId);
    if (!request || request.status !== 'pending' || !resolver) {
      return false;
    }
    request.status = 'rejected';
    request.rejectedAt = new Date();
    if (resolver.timeoutId) clearTimeout(resolver.timeoutId);
    this.resolvers.delete(requestId);
    this.requests.delete(requestId);
    resolver.resolve(false);
    return true;
  }

  delete(requestId: string): void {
    const resolver = this.resolvers.get(requestId);
    if (resolver?.timeoutId) clearTimeout(resolver.timeoutId);
    this.resolvers.delete(requestId);
    this.requests.delete(requestId);
  }

  registerResolver(requestId: string, resolver: ApprovalResolver): void {
    this.resolvers.set(requestId, resolver);
  }
}
