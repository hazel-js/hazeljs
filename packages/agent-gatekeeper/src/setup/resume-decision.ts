/**
 * Resolve a Gatekeeper approval and resume the durable / in-process run.
 */

import { getBoundGatekeeper } from './create-gatekeeper-bundle';

export interface GatekeeperResumeRuntime {
  approveToolExecution(requestId: string, approvedBy?: string): void;
  rejectToolExecution(requestId: string): void;
  approveAndResume(
    resumeId: string,
    decision: { approved: boolean; approvedBy?: string }
  ): Promise<unknown>;
  on?(event: string, handler: (event: unknown) => void): unknown;
}

export type GatekeeperHitlDecision = 'approved' | 'rejected';

/**
 * Resolve Gatekeeper approval provider (when bound) + in-process waiter + durable resume.
 */
export async function resumeGatekeeperDecision(
  runtime: GatekeeperResumeRuntime,
  requestId: string,
  decision: GatekeeperHitlDecision,
  actor = 'operator'
): Promise<unknown> {
  const bundle = getBoundGatekeeper(runtime);
  let resumeId = requestId;
  if (bundle?.enabled) {
    await bundle.approvalProvider.resolve(requestId, decision, actor);
    const rec = await bundle.approvalProvider.get(requestId);
    if (rec?.runId) resumeId = rec.runId;
  }
  try {
    if (decision === 'approved') runtime.approveToolExecution(requestId, actor);
    else runtime.rejectToolExecution(requestId);
  } catch {
    /* no in-process waiter */
  }
  return runtime.approveAndResume(resumeId, {
    approved: decision === 'approved',
    approvedBy: actor,
  });
}

export interface WireDemoHitlAutoApproveOptions {
  env?: NodeJS.ProcessEnv;
  /** Env flags that disable auto-approve when set to `1`. Default AGENT_OS_HITL + SKILLGATE_HITL. */
  skipEnvVars?: string[];
  actor?: string;
  /** Event name emitted by ToolExecutor. Default `tool.approval.requested`. */
  approvalEvent?: string;
}

/**
 * Demo convenience: auto-approve TOOL_APPROVAL_REQUESTED unless HITL env flags are set.
 */
export function wireDemoHitlAutoApprove(
  runtime: GatekeeperResumeRuntime,
  options: WireDemoHitlAutoApproveOptions = {}
): void {
  if (typeof runtime.on !== 'function') return;
  const env = options.env ?? process.env;
  const skip = options.skipEnvVars ?? ['AGENT_OS_HITL', 'SKILLGATE_HITL'];
  if (skip.some((k) => env[k] === '1')) return;
  const actor = options.actor ?? 'demo-auto-approver';
  const eventName = options.approvalEvent ?? 'tool.approval.requested';

  runtime.on(eventName, (event) => {
    const data = (event as { data?: { requestId?: string } })?.data;
    const requestId = data?.requestId;
    if (!requestId) return;
    void resumeGatekeeperDecision(runtime, requestId, 'approved', actor).catch(() => {
      /* no durable run yet — in-process approve is enough */
    });
  });
}
