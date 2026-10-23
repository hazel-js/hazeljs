/**
 * Portable node seam — LocalNode today; Remote/K8s/Cloud later.
 */

import type { AgentDna } from '../dna/agent-dna';
import type { DefineAgentInput } from '../os/define-agent';
import type { OfficeAgent, OfficeAgentStatus } from '../os/types';
import type { AgentRun } from '../run/agent-run.types';
import type { HumanTask } from '../run/human-task.service';
import type { AgentExecutionResult } from '../types/agent.types';

/** CLI-facing display states (mapped from OfficeAgentStatus). */
export type NodeAgentDisplayStatus =
  | 'Pending'
  | 'Starting'
  | 'Running'
  | 'Sleeping'
  | 'WaitingApproval'
  | 'Degraded'
  | 'Failed'
  | 'Stopped'
  | 'Recovering';

export interface NodeStatus {
  id: string;
  healthy: boolean;
  uptimeMs: number;
  version: string;
  agents: {
    running: number;
    stopped: number;
    failed: number;
    sleeping: number;
    waiting: number;
  };
  runs: {
    active: number;
    waiting: number;
  };
  storage: { status: 'Healthy' | 'Degraded' | 'Unhealthy'; path: string };
  daemon: { status: 'Running' | 'Stopped'; pid?: number; socket: string };
}

export interface AgentInspectView {
  agent: OfficeAgent;
  displayStatus: NodeAgentDisplayStatus;
  pid?: number;
  uptimeMs?: number;
  version: string;
  runs: {
    total: number;
    successful: number;
    failed: number;
    waiting: number;
  };
  health: {
    runtime: 'Healthy' | 'Degraded' | 'Unhealthy';
    storage: 'Healthy' | 'Degraded' | 'Unhealthy';
    gatekeeper: 'Healthy' | 'Degraded' | 'Unhealthy' | 'Off' | 'Missing';
  };
  skills: string[];
  restartPolicy: string;
  model?: string;
}

export interface HazelNode {
  id: string;
  status(): Promise<NodeStatus>;
  register(dna: AgentDna | DefineAgentInput): Promise<OfficeAgent>;
  apply(dna: AgentDna | DefineAgentInput): Promise<OfficeAgent>;
  start(agentId: string, input?: string): Promise<AgentRun | undefined>;
  stop(agentId: string): Promise<OfficeAgent>;
  restart(agentId: string): Promise<OfficeAgent>;
  remove(agentId: string): Promise<void>;
  inspect(agentId: string): Promise<AgentInspectView>;
  list(): Promise<OfficeAgent[]>;
  listApprovals(): Promise<HumanTask[]>;
  approve(taskId: string, by?: string): Promise<AgentExecutionResult>;
  deny(taskId: string, by?: string): Promise<AgentExecutionResult>;
  listRuns(agentId?: string): Promise<AgentRun[]>;
  recover(): Promise<{
    reclaimed: number;
    rearmed: number;
    continued: number;
    preservedHitl?: number;
  }>;
  dispose(): Promise<void>;
}

export function toDisplayStatus(status: OfficeAgentStatus): NodeAgentDisplayStatus {
  switch (status) {
    case 'deploying':
      return 'Starting';
    case 'idle':
    case 'working':
      return 'Running';
    case 'sleeping':
      return 'Sleeping';
    case 'waiting':
      return 'Recovering';
    case 'approval_required':
      return 'WaitingApproval';
    case 'failed':
      return 'Failed';
    case 'paused':
    case 'terminated':
      return 'Stopped';
    default:
      return 'Pending';
  }
}
