/**
 * Factory for a complete Agent VM runtime stack.
 */

import type { IAgentStateManager } from '@hazeljs/agent';
import { EffectGate, type EffectExecutionContext } from '../gate/effect-gate';
import type { AgentVmEventEmitter } from '../events/vm-event.types';
import { EffectJournal } from '../journal/effect-journal';
import { InMemoryJournalStore } from '../journal/stores/memory-journal.store';
import {
  SpeculationScheduler,
  type SpeculationSchedulerOptions,
} from '../speculation/speculation-scheduler';
import { TransactionCoordinator } from '../transaction/transaction-coordinator';
import type { ToolMetadata } from '@hazeljs/agent';

export interface CreateAgentVmRuntimeOptions {
  stateManager: IAgentStateManager;
  emit?: AgentVmEventEmitter;
  resolveAgentInstance?: (agentId: string) => unknown;
  resolveTool?: (agentId: string, toolPropertyKey: string) => ToolMetadata | undefined;
  journal?: EffectJournal;
  barrierMode?: 'converge' | 'abort' | 'store-buffer';
  enableStoreBuffer?: boolean;
}

export interface AgentVmRuntimeBundle {
  journal: EffectJournal;
  coordinator: TransactionCoordinator;
  effectGate: EffectGate;
  scheduler: SpeculationScheduler;
}

export function createAgentVmRuntime(options: CreateAgentVmRuntimeOptions): AgentVmRuntimeBundle {
  const journal = options.journal ?? new EffectJournal(new InMemoryJournalStore());
  const schedulerRef: { current?: SpeculationScheduler } = {};

  const coordinator = new TransactionCoordinator({
    journal,
    emit: options.emit,
    resolveAgentInstance: options.resolveAgentInstance,
    resolveTool: options.resolveTool,
  });

  const effectGate = new EffectGate({
    journal,
    emit: options.emit,
    getExecutionContext: (): EffectExecutionContext | undefined =>
      schedulerRef.current?.getExecutionContext(),
    barrierMode: options.barrierMode,
    enableStoreBuffer: options.enableStoreBuffer,
  });

  const schedulerOpts: SpeculationSchedulerOptions = {
    journal,
    coordinator,
    effectGate,
    stateManager: options.stateManager,
    emit: options.emit,
  };

  const scheduler = new SpeculationScheduler(schedulerOpts);
  schedulerRef.current = scheduler;

  return { journal, coordinator, effectGate, scheduler };
}
