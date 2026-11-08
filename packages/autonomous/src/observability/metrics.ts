/**
 * Low-cardinality autonomous metrics (OpenTelemetry-friendly names).
 * Labels must never include run ids or sensitive arguments.
 */

export interface AutonomousMetricsSnapshot {
  runsTotal: number;
  decisionsTotal: number;
  capabilitiesExecuted: number;
  capabilitiesDenied: number;
  approvalsPending: number;
  retriesTotal: number;
  recoveriesTotal: number;
  budgetExceededTotal: number;
  runDurationMsSum: number;
  runDurationMsCount: number;
}

export class AutonomousMetrics {
  private snapshot: AutonomousMetricsSnapshot = {
    runsTotal: 0,
    decisionsTotal: 0,
    capabilitiesExecuted: 0,
    capabilitiesDenied: 0,
    approvalsPending: 0,
    retriesTotal: 0,
    recoveriesTotal: 0,
    budgetExceededTotal: 0,
    runDurationMsSum: 0,
    runDurationMsCount: 0,
  };

  private readonly otel: {
    counter: (name: string, value?: number) => void;
  };

  constructor(enabled = true) {
    this.otel = createOtelBridge(enabled);
  }

  incRuns(): void {
    this.snapshot.runsTotal += 1;
    this.otel.counter('hazel.autonomous.runs');
  }

  incDecisions(): void {
    this.snapshot.decisionsTotal += 1;
    this.otel.counter('hazel.autonomous.decisions');
  }

  incExecuted(): void {
    this.snapshot.capabilitiesExecuted += 1;
    this.otel.counter('hazel.autonomous.capabilities.executed');
  }

  incDenied(): void {
    this.snapshot.capabilitiesDenied += 1;
    this.otel.counter('hazel.autonomous.capabilities.denied');
  }

  setApprovalsPending(n: number): void {
    this.snapshot.approvalsPending = n;
  }

  incRetries(): void {
    this.snapshot.retriesTotal += 1;
    this.otel.counter('hazel.autonomous.retries');
  }

  incRecoveries(): void {
    this.snapshot.recoveriesTotal += 1;
    this.otel.counter('hazel.autonomous.recoveries');
  }

  incBudgetExceeded(): void {
    this.snapshot.budgetExceededTotal += 1;
    this.otel.counter('hazel.autonomous.budget_exceeded');
  }

  recordDuration(ms: number): void {
    this.snapshot.runDurationMsSum += ms;
    this.snapshot.runDurationMsCount += 1;
  }

  getSnapshot(): AutonomousMetricsSnapshot {
    return { ...this.snapshot };
  }
}

function createOtelBridge(enabled: boolean): { counter: (name: string, value?: number) => void } {
  if (!enabled) {
    return { counter: (_name: string, _value?: number): void => undefined };
  }
  try {
    // Optional peer — never hard-require.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('@opentelemetry/api') as {
      metrics?: {
        getMeter: (name: string) => {
          createCounter: (name: string) => { add: (n: number) => void };
        };
      };
    };
    const meter = api.metrics?.getMeter('hazeljs.autonomous');
    const cache = new Map<string, { add: (n: number) => void }>();
    return {
      counter(name: string, value = 1): void {
        if (!meter) return;
        let c = cache.get(name);
        if (!c) {
          c = meter.createCounter(name);
          cache.set(name, c);
        }
        c.add(value);
      },
    };
  } catch {
    return { counter: (_name: string, _value?: number): void => undefined };
  }
}
