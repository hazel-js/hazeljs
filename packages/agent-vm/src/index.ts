/**
 * @hazeljs/agent-vm — Effect-typed agent execution with speculation and rollback.
 */

export * from './effects/effect-kind';
export * from './effects/effect.decorator';
export * from './effects/compensate.decorator';
export * from './effects/infer';

export * from './journal/journal-entry.types';
export * from './journal/journal-store.interface';
export * from './journal/effect-journal';
export * from './journal/stores/memory-journal.store';
export * from './journal/stores/file-journal.store';

export * from './gate/effect-gate';

export * from './transaction/compensation-error';
export * from './transaction/quarantine-store';
export * from './transaction/transaction-coordinator';
export * from './transaction/atomic.decorator';

export * from './speculation/speculate.decorator';
export * from './speculation/barrier-handler';
export * from './speculation/branch-state';
export * from './speculation/budget-slicer';
export * from './speculation/scorers/index';
export * from './speculation/speculation-scheduler';

export * from './events/vm-event.types';
export * from './runtime/create-agent-vm-runtime';
export * from './runtime/attach-agent-vm';

export * from './demo/travel-agent.demo';
