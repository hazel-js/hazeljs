export interface ApprovalRequest {
  toolName: string;
  input: unknown;
  idempotencyKey: string;
  /** Present when resuming after a prior Gatekeeper / HITL approval. */
  approvalToken?: string;
  /** Opaque caller identity (AgentToolCaller or Gatekeeper TrustedCallerContext). */
  caller?: unknown;
}

export type ApprovalDecision =
  'approved' | { rejected: string } | { pending: { approvalId: string } };

export interface ApprovalPort {
  approve(request: ApprovalRequest): Promise<ApprovalDecision>;
}

/** In-memory port for tests: approve unless a pending decision was set. */
export class InMemoryApprovalPort implements ApprovalPort {
  private decisions = new Map<string, ApprovalDecision>();
  private readonly waiting: ApprovalRequest[] = [];

  setDecision(idempotencyKey: string, decision: ApprovalDecision): void {
    this.decisions.set(idempotencyKey, decision);
  }

  pending(): ApprovalRequest[] {
    return [...this.waiting];
  }

  async approve(request: ApprovalRequest): Promise<ApprovalDecision> {
    this.waiting.push(request);
    const existing = this.decisions.get(request.idempotencyKey);
    if (existing) {
      return existing;
    }
    return 'approved';
  }
}
