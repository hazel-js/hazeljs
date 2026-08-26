/**
 * Project kernel + HITL + desired-state onto office occupancy statuses.
 */

import { AgentRunStatus, type AgentRun } from '../run/agent-run.types';
import { AgentState } from '../types/agent.types';
import type { DesiredAgentPhase, OfficeAgentOccupancy, OfficeAgentStatus } from './types';

const ACTIVE_RUN: ReadonlySet<AgentRunStatus> = new Set([
  AgentRunStatus.RUNNING,
  AgentRunStatus.QUEUED,
  AgentRunStatus.RETRYING,
  AgentRunStatus.WAITING_FOR_TOOL,
  AgentRunStatus.WAITING_FOR_AGENT,
  AgentRunStatus.WAITING_FOR_MODEL,
]);

const WAITING_RUN: ReadonlySet<AgentRunStatus> = new Set([
  AgentRunStatus.WAITING_FOR_HUMAN,
  AgentRunStatus.SUSPENDED,
]);

export interface ProjectOfficeStatusInput {
  occupancy?: Partial<OfficeAgentOccupancy>;
  currentRun?: AgentRun;
  pendingApprovals?: number;
  executorState?: AgentState | string;
}

export function projectOfficeStatus(input: ProjectOfficeStatusInput): OfficeAgentStatus {
  const desired: DesiredAgentPhase = input.occupancy?.desiredPhase ?? 'running';
  if (desired === 'terminated') return 'terminated';
  if (desired === 'paused') return 'paused';

  if (
    (input.pendingApprovals ?? 0) > 0 ||
    input.currentRun?.status === AgentRunStatus.WAITING_FOR_HUMAN ||
    input.executorState === AgentState.WAITING_FOR_APPROVAL
  ) {
    return 'approval_required';
  }

  if (desired === 'sleeping') return 'sleeping';

  if (input.currentRun?.status === AgentRunStatus.FAILED) return 'failed';

  if (
    WAITING_RUN.has(input.currentRun?.status as AgentRunStatus) ||
    input.executorState === AgentState.WAITING_FOR_INPUT
  ) {
    return 'waiting';
  }

  if (
    ACTIVE_RUN.has(input.currentRun?.status as AgentRunStatus) ||
    input.executorState === AgentState.THINKING ||
    input.executorState === AgentState.PLANNING ||
    input.executorState === AgentState.USING_TOOL ||
    input.executorState === AgentState.SEARCHING_KNOWLEDGE ||
    input.executorState === AgentState.SEARCHING_MEMORY ||
    input.executorState === AgentState.VALIDATING
  ) {
    return 'working';
  }

  if (input.occupancy?.desiredPhase === 'running' && !input.currentRun) {
    return 'idle';
  }

  return 'idle';
}

export function occupancyFromBackend(
  backend: Record<string, unknown> | undefined
): OfficeAgentOccupancy {
  const desired = backend?.desiredPhase;
  return {
    desiredPhase:
      desired === 'paused' ||
      desired === 'sleeping' ||
      desired === 'terminated' ||
      desired === 'running'
        ? desired
        : 'running',
    nextWakeAt: typeof backend?.nextWakeAt === 'string' ? backend.nextWakeAt : undefined,
    currentTask: typeof backend?.currentTask === 'string' ? backend.currentTask : undefined,
    currentStage: typeof backend?.currentStage === 'string' ? backend.currentStage : undefined,
    sleepJobId: typeof backend?.sleepJobId === 'string' ? backend.sleepJobId : undefined,
  };
}
