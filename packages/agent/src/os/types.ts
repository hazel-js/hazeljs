/**
 * Agent OS occupancy types — control-plane view of a deployed agent.
 * Distinct from AgentRunStatus (kernel) and AgentState (executor).
 */

import type { AgentDna } from '../dna/agent-dna';
import type { AgentRun } from '../run/agent-run.types';

export type OfficeAgentStatus =
  | 'deploying'
  | 'idle'
  | 'working'
  | 'sleeping'
  | 'waiting'
  | 'approval_required'
  | 'failed'
  | 'paused'
  | 'terminated';

export type DesiredAgentPhase = 'running' | 'paused' | 'sleeping' | 'terminated';

export interface OfficeAgentOccupancy {
  desiredPhase: DesiredAgentPhase;
  nextWakeAt?: string;
  currentTask?: string;
  currentStage?: string;
  sleepJobId?: string;
}

export interface OfficeAgent {
  id: string;
  name: string;
  description?: string;
  status: OfficeAgentStatus;
  dna: AgentDna;
  namespace: string;
  occupancy: OfficeAgentOccupancy;
  currentRun?: AgentRun;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeSkillSummary {
  name: string;
  description?: string;
  requiresApproval?: boolean;
  agents: string[];
}

export interface OfficeMetricsSnapshot {
  agents: number;
  working: number;
  waiting: number;
  approvalRequired: number;
  sleeping: number;
  failed: number;
  runs24h: number;
  successRate: number;
  skillCalls: number;
  tokens: number;
  estimatedCostUsd?: number;
}
