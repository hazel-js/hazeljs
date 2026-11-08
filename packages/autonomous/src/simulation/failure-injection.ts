/**
 * Failure injection scenarios for simulation (Phase 5).
 * Applied only when AutonomousRuntime is constructed with simulation: true.
 */

export type FailureScenario =
  | 'database-unavailable'
  | 'worker-crash'
  | 'tool-timeout'
  | 'provider-error'
  | 'duplicate-event'
  | 'approval-expired'
  | 'capability-denied'
  | 'lease-lost'
  | 'network-after-effect'
  | 'retry-budget-exceeded';

export interface FailureInjectionConfig {
  scenarios: FailureScenario[];
  /** Probability 0–1 when a scenario is stochastic. Default 1 (always). */
  probability?: number;
}

export class FailureInjector {
  constructor(private readonly config: FailureInjectionConfig = { scenarios: [] }) {}

  shouldInject(scenario: FailureScenario): boolean {
    if (!this.config.scenarios.includes(scenario)) return false;
    const p = this.config.probability ?? 1;
    return Math.random() < p;
  }

  maybeThrow(scenario: FailureScenario, message?: string): void {
    if (!this.shouldInject(scenario)) return;
    throw new Error(message ?? `Injected failure: ${scenario}`);
  }
}
