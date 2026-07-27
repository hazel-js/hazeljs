import { compareBenchmarkRuns, runBenchmark, summarizeBenchmarkRun } from './benchmark';

describe('@hazeljs/benchmark', () => {
  it('summarizeBenchmarkRun aggregates empty and populated runs', () => {
    expect(summarizeBenchmarkRun('empty', [])).toMatchObject({
      label: 'empty',
      averageScore: 0,
      averageDurationMs: 0,
      passRate: 0,
      cases: [],
    });

    const run = summarizeBenchmarkRun(
      'baseline',
      [
        { id: '1', score: 1, durationMs: 10, passed: true },
        { id: '2', score: 0.5, durationMs: 30, passed: false, costUsd: 0.01 },
      ],
      'abc123'
    );
    expect(run.commit).toBe('abc123');
    expect(run.averageScore).toBe(0.75);
    expect(run.averageDurationMs).toBe(20);
    expect(run.passRate).toBe(0.5);
    expect(run.at).toMatch(/^\d{4}-/);
  });

  it('compareBenchmarkRuns detects regressions and improvements', () => {
    const baseline = summarizeBenchmarkRun('b', [
      { id: '1', score: 1, durationMs: 10, passed: true },
      { id: '2', score: 0.8, durationMs: 20, passed: true },
      { id: 'only-base', score: 1, durationMs: 5, passed: true },
    ]);
    const candidate = summarizeBenchmarkRun('c', [
      { id: '1', score: 0.5, durationMs: 15, passed: false },
      { id: '2', score: 1, durationMs: 10, passed: true },
      { id: 'only-cand', score: 1, durationMs: 5, passed: true },
    ]);

    const cmp = compareBenchmarkRuns(baseline, candidate);
    expect(cmp.regressions).toEqual([{ id: '1', baselineScore: 1, candidateScore: 0.5 }]);
    expect(cmp.improvements).toEqual([{ id: '2', baselineScore: 0.8, candidateScore: 1 }]);
    expect(cmp.scoreDelta).toBeCloseTo(candidate.averageScore - baseline.averageScore);
    expect(cmp.durationDeltaMs).toBeCloseTo(
      candidate.averageDurationMs - baseline.averageDurationMs
    );
    expect(cmp.passRateDelta).toBeCloseTo(candidate.passRate - baseline.passRate);

    const strict = compareBenchmarkRuns(baseline, candidate, 0.5);
    expect(strict.improvements).toHaveLength(0);
    expect(strict.regressions).toHaveLength(1);
  });

  it('runBenchmark collects scores, default passed threshold, and errors', async () => {
    const run = await runBenchmark({
      label: 'nightly',
      commit: 'deadbeef',
      cases: [
        { id: 'ok', input: 'a' },
        { id: 'borderline', input: 'b' },
        { id: 'fail', input: 'c' },
      ],
      run: async (_input, id) => {
        if (id === 'fail') throw new Error('boom');
        if (id === 'borderline') {
          return { score: 0.69, durationMs: 8, costUsd: 0.02 };
        }
        return { score: 0.9, durationMs: 5, passed: true, costUsd: 0.01 };
      },
    });

    expect(run.label).toBe('nightly');
    expect(run.commit).toBe('deadbeef');
    expect(run.cases).toHaveLength(3);
    expect(run.cases.find((c) => c.id === 'ok')).toMatchObject({
      score: 0.9,
      passed: true,
      costUsd: 0.01,
    });
    expect(run.cases.find((c) => c.id === 'borderline')?.passed).toBe(false);
    expect(run.cases.find((c) => c.id === 'fail')).toMatchObject({
      score: 0,
      durationMs: 0,
      passed: false,
      error: 'boom',
    });
  });
});
