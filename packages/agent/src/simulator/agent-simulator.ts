/**
 * Agent OS Phase 3 — Agent Simulator (synthetic load + failure reports)
 */

export interface SimulatorCase {
  id: string;
  input: string;
  /** Optional weight for sampling (default 1). */
  weight?: number;
}

export interface SimulatorOptions {
  concurrency?: number;
  iterations?: number;
  cases: SimulatorCase[];
  run: (
    input: string,
    caseId: string
  ) => Promise<{ ok: boolean; durationMs: number; error?: string; output?: string }>;
}

export interface SimulatorFailure {
  caseId: string;
  input: string;
  error?: string;
  output?: string;
  durationMs: number;
}

export interface SimulatorReport {
  total: number;
  passed: number;
  failed: number;
  avgDurationMs: number;
  p95DurationMs: number;
  failures: SimulatorFailure[];
}

function pickCase(cases: SimulatorCase[]): SimulatorCase {
  const total = cases.reduce((s, c) => s + (c.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const c of cases) {
    r -= c.weight ?? 1;
    if (r <= 0) return c;
  }
  return cases[cases.length - 1];
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export async function runAgentSimulator(opts: SimulatorOptions): Promise<SimulatorReport> {
  const concurrency = Math.max(1, opts.concurrency ?? 5);
  const iterations = Math.max(1, opts.iterations ?? opts.cases.length);
  const failures: SimulatorFailure[] = [];
  const durations: number[] = [];
  let passed = 0;
  let failed = 0;
  let next = 0;

  const worker = async (): Promise<void> => {
    let active = true;
    while (active) {
      const i = next++;
      if (i >= iterations) {
        active = false;
        break;
      }
      const c = pickCase(opts.cases);
      try {
        const res = await opts.run(c.input, c.id);
        durations.push(res.durationMs);
        if (res.ok) passed += 1;
        else {
          failed += 1;
          failures.push({
            caseId: c.id,
            input: c.input,
            error: res.error,
            output: res.output,
            durationMs: res.durationMs,
          });
        }
      } catch (e) {
        failed += 1;
        failures.push({
          caseId: c.id,
          input: c.input,
          error: (e as Error).message,
          durationMs: 0,
        });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const sorted = [...durations].sort((a, b) => a - b);
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;

  return {
    total: iterations,
    passed,
    failed,
    avgDurationMs: avg,
    p95DurationMs: percentile(sorted, 95),
    failures,
  };
}
