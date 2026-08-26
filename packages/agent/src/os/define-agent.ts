/**
 * defineAgent — developer-facing DNA constructor.
 */

import {
  exportAgentDna,
  type AgentAutonomy,
  type AgentDna,
  type AgentDnaMemory,
  type AgentDnaSchedule,
  type AgentDnaSlo,
  type AgentDnaTool,
} from '../dna/agent-dna';

export interface DefineAgentInput {
  name: string;
  description?: string;
  role?: string;
  mission: string;
  instructions?: string[];
  model?: string;
  provider?: string;
  temperature?: number;
  skills?: Array<string | AgentDnaTool>;
  autonomy?: AgentAutonomy;
  policies?: unknown[];
  schedule?: AgentDnaSchedule | AgentScheduleShortcut;
  memory?: AgentDnaMemory;
  slo?: AgentDnaSlo;
  version?: string;
}

export type AgentScheduleShortcut = 'always' | 'hourly' | 'daily' | 'manual';

export function daily(hhmm: string): AgentDnaSchedule {
  return { kind: 'daily', cron: hhmm };
}

export function hourly(): AgentDnaSchedule {
  return { kind: 'hourly' };
}

function normalizeSchedule(
  schedule?: AgentDnaSchedule | AgentScheduleShortcut
): AgentDnaSchedule | undefined {
  if (!schedule) return undefined;
  if (typeof schedule === 'string') {
    return { kind: schedule };
  }
  return schedule;
}

function normalizeSkills(skills?: Array<string | AgentDnaTool>): AgentDnaTool[] {
  return (skills ?? []).map((s) => (typeof s === 'string' ? { name: s } : s));
}

export function defineAgent(input: DefineAgentInput): AgentDna {
  return exportAgentDna({
    name: input.name,
    description: input.description,
    version: input.version,
    model: input.model,
    modelConfig: input.provider
      ? { provider: input.provider, model: input.model, temperature: input.temperature }
      : input.model
        ? { model: input.model, temperature: input.temperature }
        : undefined,
    identity: {
      name: input.name,
      role: input.role,
      description: input.description,
    },
    mission: {
      goal: input.mission,
      instructions: input.instructions,
    },
    tools: normalizeSkills(input.skills),
    autonomy: input.autonomy,
    policies: input.policies,
    schedule: normalizeSchedule(input.schedule),
    memory: input.memory ?? { enabled: true, strategy: 'working+long-term' },
    slo: input.slo,
  });
}
