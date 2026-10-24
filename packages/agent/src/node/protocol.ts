/**
 * Local control API protocol (CLI ↔ hazeld).
 */

import type { AgentDna } from '../dna/agent-dna';
import type { DefineAgentInput } from '../os/define-agent';

export type ControlRequest =
  | { op: 'ping' }
  | { op: 'status' }
  | { op: 'list' }
  | { op: 'inspect'; agentId: string }
  | { op: 'apply'; dna: AgentDna | DefineAgentInput }
  | { op: 'start'; agentId: string; input?: string }
  | { op: 'stop'; agentId: string }
  | { op: 'restart'; agentId: string }
  | { op: 'remove'; agentId: string }
  | { op: 'run'; agentId: string; input?: string }
  | { op: 'runs'; agentId?: string }
  | { op: 'approvals' }
  | { op: 'approve'; taskId: string; by?: string }
  | { op: 'deny'; taskId: string; by?: string }
  | { op: 'recover' }
  | { op: 'metrics' }
  | { op: 'skills' }
  | { op: 'secret.set'; name: string; value: string }
  | { op: 'secret.delete'; name: string }
  | { op: 'secret.has'; name: string }
  | { op: 'shutdown' };

export interface ControlResponse {
  ok: boolean;
  error?: string;
  data?: unknown;
}
