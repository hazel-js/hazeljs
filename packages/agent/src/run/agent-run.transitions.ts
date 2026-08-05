/**
 * Allowed AgentRunStatus transitions
 */

import { AgentRunStatus, AgentRunTransitionError } from './agent-run.types';

const TERMINAL = new Set<AgentRunStatus>([
  AgentRunStatus.COMPLETED,
  AgentRunStatus.FAILED,
  AgentRunStatus.CANCELLED,
  AgentRunStatus.TIMED_OUT,
]);

const ALLOWED: Record<AgentRunStatus, AgentRunStatus[]> = {
  [AgentRunStatus.CREATED]: [
    AgentRunStatus.QUEUED,
    AgentRunStatus.RUNNING,
    AgentRunStatus.CANCELLED,
  ],
  [AgentRunStatus.QUEUED]: [AgentRunStatus.RUNNING, AgentRunStatus.CANCELLED],
  [AgentRunStatus.RUNNING]: [
    AgentRunStatus.WAITING_FOR_HUMAN,
    AgentRunStatus.WAITING_FOR_TOOL,
    AgentRunStatus.WAITING_FOR_AGENT,
    AgentRunStatus.WAITING_FOR_MODEL,
    AgentRunStatus.SUSPENDED,
    AgentRunStatus.RETRYING,
    AgentRunStatus.COMPLETED,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
    AgentRunStatus.TIMED_OUT,
  ],
  [AgentRunStatus.WAITING_FOR_HUMAN]: [
    AgentRunStatus.SUSPENDED,
    AgentRunStatus.RUNNING,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
    AgentRunStatus.TIMED_OUT,
  ],
  [AgentRunStatus.WAITING_FOR_TOOL]: [
    AgentRunStatus.SUSPENDED,
    AgentRunStatus.RUNNING,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
    AgentRunStatus.TIMED_OUT,
  ],
  [AgentRunStatus.WAITING_FOR_AGENT]: [
    AgentRunStatus.SUSPENDED,
    AgentRunStatus.RUNNING,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
    AgentRunStatus.TIMED_OUT,
  ],
  [AgentRunStatus.WAITING_FOR_MODEL]: [
    AgentRunStatus.SUSPENDED,
    AgentRunStatus.RUNNING,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
    AgentRunStatus.TIMED_OUT,
  ],
  [AgentRunStatus.SUSPENDED]: [
    AgentRunStatus.RUNNING,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
    AgentRunStatus.TIMED_OUT,
  ],
  [AgentRunStatus.RETRYING]: [
    AgentRunStatus.RUNNING,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
  ],
  [AgentRunStatus.COMPLETED]: [],
  [AgentRunStatus.FAILED]: [],
  [AgentRunStatus.CANCELLED]: [],
  [AgentRunStatus.TIMED_OUT]: [],
};

export function isTerminalRunStatus(status: AgentRunStatus): boolean {
  return TERMINAL.has(status);
}

export function canTransitionAgentRun(from: AgentRunStatus, to: AgentRunStatus): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertAgentRunTransition(
  runId: string,
  from: AgentRunStatus,
  to: AgentRunStatus
): void {
  if (!canTransitionAgentRun(from, to)) {
    throw new AgentRunTransitionError(runId, from, to);
  }
}
