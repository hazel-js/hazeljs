/**
 * Agent VM event types (emitted via ToolExecutor / SpeculationScheduler callbacks).
 */

export enum AgentVmEventType {
  EFFECT_JOURNALED = 'agent.vm.effect.journaled',
  COMPENSATION_STARTED = 'agent.vm.compensation.started',
  COMPENSATION_COMPLETED = 'agent.vm.compensation.completed',
  COMPENSATION_FAILED = 'agent.vm.compensation.failed',
  SPECULATION_STARTED = 'agent.vm.speculation.started',
  SPECULATION_BRANCH_STARTED = 'agent.vm.speculation.branch.started',
  SPECULATION_BRANCH_COMPLETED = 'agent.vm.speculation.branch.completed',
  SPECULATION_BRANCH_PRUNED = 'agent.vm.speculation.branch.pruned',
  SPECULATION_COMMITTED = 'agent.vm.speculation.committed',
  SPECULATION_ROLLED_BACK = 'agent.vm.speculation.rolled_back',
  BARRIER_HIT = 'agent.vm.barrier.hit',
  BARRIER_CONVERGED = 'agent.vm.barrier.converged',
  BARRIER_ABORTED = 'agent.vm.barrier.aborted',
  ATOMIC_UNDO_STARTED = 'agent.vm.atomic.undo.started',
  ATOMIC_UNDO_COMPLETED = 'agent.vm.atomic.undo.completed',
}

export interface AgentVmEvent<T = unknown> {
  type: AgentVmEventType;
  runId?: string;
  branchId?: string;
  agentId?: string;
  timestamp: Date;
  data: T;
}

export type AgentVmEventEmitter = (event: AgentVmEvent) => void;
