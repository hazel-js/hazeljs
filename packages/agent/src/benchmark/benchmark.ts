/**
 * Agent OS Phase 2 — Benchmark framework
 * Compare agent golden runs across commits / labels.
 */

export interface BenchmarkCaseResult {
  id: string;
  score: number;
  durationMs: number;
  costUsd?: number;
  passed: boolean;
  error?: string;
}

export interface BenchmarkRun {
  label: string;
  commit?: string;
  at: string;
  cases: BenchmarkCaseResult[];
  averageScore: number;
  averageDurationMs: number;
  passRate: number;
}

export interface BenchmarkCompareResult {
  baseline: BenchmarkRun;
  candidate: BenchmarkRun;
  scoreDelta: number;
  durationDeltaMs: number;
  passRateDelta: number;
  regressions: Array<{ id: string; baselineScore: number; candidateScore: number }>;
  improvements: Array<{ id: string; baselineScore: number; candidateScore: number }>;
}

export function summarizeBenchmarkRun(
  label: string,
  cases: BenchmarkCaseResult[],
  commit?: string
): BenchmarkRun {
  const averageScore = cases.length
    ? cases.reduce((s, c) => s + c.score, 0) / cases.length
    : 0;
  const averageDurationMs = cases.length
    ? cases.reduce((s, c) => s + c.durationMs, 0) / cases.length
    : 0;
  const passRate = cases.length ? cases.filter((c) => c.passed).length / cases.length : 0;
  return {
    label,
    commit,
    at: new Date().toISOString(),
    cases,
    averageScore,
    averageDurationMs,
    passRate,
  };
}

export function compareBenchmarkRuns(
  baseline: BenchmarkRun,
  candidate: BenchmarkRun,
  regressionThreshold = 0.05
): BenchmarkCompareResult {
  const byId = new Map(baseline.cases.map((c) => [c.id, c]));
  const regressions: BenchmarkCompareResult['regressions'] = [];
  const improvements: BenchmarkCompareResult['improvements'] = [];

  for (const c of candidate.cases) {
    const b = byId.get(c.id);
    if (!b) continue;
    const delta = c.score - b.score;
    if (delta <= -regressionThreshold) {
      regressions.push({ id: c.id, baselineScore: b.score, candidateScore: c.score });
    } else if (delta >= regressionThreshold) {
      improvements.push({ id: c.id, baselineScore: b.score, candidateScore: c.score });
    }
  }

  return {
    baseline,
    candidate,
    scoreDelta: candidate.averageScore - baseline.averageScore,
    durationDeltaMs: candidate.averageDurationMs - baseline.averageDurationMs,
    passRateDelta: candidate.passRate - baseline.passRate,
    regressions,
    improvements,
  };
}

export async function runBenchmark(opts: {
  label: string;
  commit?: string;
  cases: Array<{ id: string; input: string }>;
  run: (input: string, id: string) => Promise<{ score: number; durationMs: number; costUsd?: number; passed?: boolean; error?: string }>;
}): Promise<BenchmarkRun> {
  const results: BenchmarkCaseResult[] = [];
  for (const c of opts.cases) {
    try {
      const r = await opts.run(c.input, c.id);
      results.push({
        id: c.id,
        score: r.score,
        durationMs: r.durationMs,
        costUsd: r.costUsd,
        passed: r.passed ?? r.score >= 0.7,
        error: r.error,
      });
    } catch (e) {
      results.push({
        id: c.id,
        score: 0,
        durationMs: 0,
        passed: false,
        error: (e as Error).message,
      });
    }
  }
  return summarizeBenchmarkRun(opts.label, results, opts.commit);
}
