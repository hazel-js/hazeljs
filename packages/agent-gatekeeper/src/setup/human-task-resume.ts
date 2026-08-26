/**
 * HumanTask-aware ToolExecutor authorization gate.
 *
 * AgentRuntime resume uses skipApproval, which the gate path ignores — so we
 * look up an already-approved HumanTask / provider record and pass approvalToken.
 */

import { invocationFingerprint } from '../security';
import type { ToolExecutorGateInput } from '../types';

export interface HumanTaskLookup {
  listByRun(runId: string): Promise<
    Array<{
      id: string;
      status?: string;
      toolName?: string;
      payload?: unknown;
    }>
  >;
}

export function shortToolName(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1) : name;
}

export async function findApprovedHumanTaskToken(
  humanTasks: HumanTaskLookup | undefined,
  input: {
    runId: string;
    agentId: string;
    toolName: string;
    args: Record<string, unknown>;
    tenantId?: string;
  }
): Promise<string | undefined> {
  if (!humanTasks) return undefined;

  const toolName = shortToolName(input.toolName);
  const fingerprint = invocationFingerprint({
    agentId: input.agentId,
    toolName,
    input: input.args,
    tenantId: input.tenantId,
  });

  const tasks = await humanTasks.listByRun(input.runId);
  for (const task of tasks) {
    const payload =
      task.payload && typeof task.payload === 'object'
        ? (task.payload as Record<string, unknown>)
        : {};
    const raw = payload.gatekeeperRequest;
    if (!raw || typeof raw !== 'object') continue;
    const gk = raw as {
      approvalId?: string;
      toolName?: string;
      invocationFingerprint?: string;
      status?: string;
    };
    const approvalId = gk.approvalId ?? task.id;
    const gkTool = gk.toolName ? shortToolName(gk.toolName) : shortToolName(task.toolName ?? '');
    if (gkTool !== toolName) continue;
    if (gk.invocationFingerprint && gk.invocationFingerprint !== fingerprint) continue;
    if (task.status === 'approved' || gk.status === 'approved') {
      return approvalId;
    }
  }

  return undefined;
}

export function resolveLiveToolMethod(
  tool: ToolExecutorGateInput['tool']
): (...args: unknown[]) => unknown {
  const withKey = tool as ToolExecutorGateInput['tool'] & { propertyKey?: string };
  const key = withKey.propertyKey;
  const target = tool.target as Record<string, unknown> | undefined;
  if (key && target && typeof target[key] === 'function') {
    return target[key] as (...args: unknown[]) => unknown;
  }
  return tool.method as (...args: unknown[]) => unknown;
}
