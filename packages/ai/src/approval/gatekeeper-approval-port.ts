import type { ApprovalDecision, ApprovalPort, ApprovalRequest } from './approval-port';

/**
 * Duck-typed Gatekeeper / governed evaluator.
 * Does not dispatch the tool — only decides allow / deny / require_approval.
 */
export interface GatekeeperApprovalEvaluator {
  evaluate(request: {
    toolName: string;
    input: unknown;
    idempotencyKey: string;
    approvalToken?: string;
    caller?: ApprovalRequest['caller'];
  }): Promise<
    | { status: 'allowed' }
    | { status: 'denied'; reason?: string }
    | { status: 'require_approval'; approvalId: string }
  >;
}

/**
 * Bridges `@hazeljs/agent-gatekeeper` (or any governed evaluator) to ApprovalPort.
 * On `require_approval`, the AI tool loop suspends with finishReason `approval-required`.
 */
export class GatekeeperApprovalPort implements ApprovalPort {
  constructor(private readonly evaluator: GatekeeperApprovalEvaluator) {}

  async approve(request: ApprovalRequest): Promise<ApprovalDecision> {
    const result = await this.evaluator.evaluate({
      toolName: request.toolName,
      input: request.input,
      idempotencyKey: request.idempotencyKey,
      approvalToken: request.approvalToken,
      caller: request.caller,
    });
    if (result.status === 'allowed') {
      return 'approved';
    }
    if (result.status === 'denied') {
      return { rejected: result.reason ?? 'denied' };
    }
    return { pending: { approvalId: result.approvalId } };
  }
}
