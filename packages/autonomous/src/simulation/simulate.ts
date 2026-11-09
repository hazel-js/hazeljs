import type { AutonomousObservation } from '@hazeljs/core';
import { AutonomousRuntime } from '../runtime/autonomous.runtime';
import type { AutonomousModuleOptions, AutonomousRunRecord } from '../types';
import { MemoryAutonomousRunStore } from '../store/memory-run.store';

export interface SimulateOptions {
  service: string;
  event: { type: string; payload: unknown };
  fixtures?: Record<string, unknown>;
  mode?: 'dry-run';
  runtimeOptions?: AutonomousModuleOptions;
  /** Pre-started runtime; if omitted a simulation-isolated runtime is created. */
  runtime?: AutonomousRuntime;
}

/**
 * Simulation entry — hard barrier against live production effects.
 * Always runs with simulation=true (no live capability side effects).
 */
export async function simulate(options: SimulateOptions): Promise<{
  run: AutonomousRunRecord;
  timeline: AutonomousRunRecord['metadata']['timeline'];
}> {
  const runtime =
    options.runtime ??
    new AutonomousRuntime({
      ...options.runtimeOptions,
      storage: options.runtimeOptions?.storage ?? new MemoryAutonomousRunStore(),
      simulation: true,
    });

  await runtime.start();

  // Fixtures reserved for Phase 5 expansion (failure injection, clock, mocks).
  void options.fixtures;

  const ids = await runtime.emit(options.event.type, options.event.payload, {
    source: 'simulation',
    subject: options.service,
  });

  const runId = ids[0];
  if (!runId) {
    throw new Error(
      `No autonomous run created for service observation (service=${options.service})`
    );
  }

  const run = await runtime.inspect(runId);
  if (!run) throw new Error(`Simulation run missing: ${runId}`);

  return {
    run,
    timeline: run.metadata.timeline ?? [],
  };
}

export interface OutcomeRecommendation {
  type: string;
  message: string;
}

/**
 * Recommendation-only outcome evaluator (no automatic policy weakening).
 */
export async function evaluateOutcome(
  run: AutonomousRunRecord,
  _observations: AutonomousObservation[] = []
): Promise<{ success: boolean; recommendations: OutcomeRecommendation[] }> {
  const recommendations: OutcomeRecommendation[] = [];
  const timeline = run.metadata.timeline ?? [];

  if (run.metadata.effectStatus === 'uncertain') {
    recommendations.push({
      type: 'reconciliation',
      message: 'Effect outcome uncertain — review reconciliation before retry.',
    });
  }

  const denials = timeline.filter((e) => e.type === 'capability.denied').length;
  if (denials > 0) {
    recommendations.push({
      type: 'policy-review',
      message: 'Capability denials observed — review grants and Gatekeeper policies.',
    });
  }

  const approvals = timeline.filter((e) => e.type === 'approval.pending').length;
  if (approvals > 2) {
    recommendations.push({
      type: 'approval-policy',
      message:
        'Frequent approval waits — consider tightening auto-approved idempotent capabilities.',
    });
  }

  return {
    success: run.status === 'completed' && run.metadata.effectStatus !== 'failed',
    recommendations,
  };
}
