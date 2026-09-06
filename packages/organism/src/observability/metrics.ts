/**
 * Optional OpenTelemetry-compatible metrics for organism runtime.
 */

export interface OrganismMetricsSnapshot {
  activeAgents: number;
  agentsSpawnedTotal: number;
  agentsTerminatedTotal: number;
  reproductionsTotal: number;
  mutationsTotal: number;
  tokenUsage: number;
  cost: number;
  missionProgress: number;
  constitutionViolations: number;
}

export class OrganismMetrics {
  private spawned = 0;
  private terminated = 0;
  private reproductions = 0;
  private mutations = 0;
  private tokens = 0;
  private cost = 0;
  private violations = 0;
  private active = 0;
  private missionProgress = 0;

  recordSpawn(): void {
    this.spawned += 1;
    this.active += 1;
  }

  recordReproduction(): void {
    this.reproductions += 1;
    this.spawned += 1;
    this.active += 1;
  }

  recordMutation(): void {
    this.mutations += 1;
  }

  recordTermination(): void {
    this.terminated += 1;
    this.active = Math.max(0, this.active - 1);
  }

  recordTokens(n: number): void {
    this.tokens += n;
  }

  recordCost(n: number): void {
    this.cost += n;
  }

  recordViolation(): void {
    this.violations += 1;
  }

  setMissionProgress(ratio: number): void {
    this.missionProgress = ratio;
  }

  snapshot(): OrganismMetricsSnapshot {
    return {
      activeAgents: this.active,
      agentsSpawnedTotal: this.spawned,
      agentsTerminatedTotal: this.terminated,
      reproductionsTotal: this.reproductions,
      mutationsTotal: this.mutations,
      tokenUsage: this.tokens,
      cost: this.cost,
      missionProgress: this.missionProgress,
      constitutionViolations: this.violations,
    };
  }

  /** Soft-bind to OpenTelemetry if available. */
  exportToOtel(meterName = 'hazel.organism'): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const otel = require('@opentelemetry/api') as {
        metrics?: {
          getMeter: (name: string) => {
            createObservableGauge: (
              name: string,
              opts: { description: string },
              cb: (obs: { observe: (v: number) => void }) => void
            ) => void;
          };
        };
      };
      const meter = otel.metrics?.getMeter(meterName);
      if (!meter) return;
      const snap = (): OrganismMetricsSnapshot => this.snapshot();
      meter.createObservableGauge(
        'hazel.organism.active_agents',
        { description: 'Active organism agents' },
        (obs) => obs.observe(snap().activeAgents)
      );
      meter.createObservableGauge(
        'hazel.organism.agents_spawned_total',
        { description: 'Total agents spawned' },
        (obs) => obs.observe(snap().agentsSpawnedTotal)
      );
      meter.createObservableGauge(
        'hazel.organism.token_usage',
        { description: 'Organism token usage' },
        (obs) => obs.observe(snap().tokenUsage)
      );
      meter.createObservableGauge(
        'hazel.organism.mission_progress',
        { description: 'Mission progress ratio' },
        (obs) => obs.observe(snap().missionProgress)
      );
    } catch {
      // optional peer
    }
  }
}
