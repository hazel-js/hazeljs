/**
 * Performance regression harness placeholder.
 * Record methodology when running full benchmarks — do not invent numbers.
 */
describe('AAR performance harness', () => {
  it('documents measurement methodology', () => {
    const methodology = {
      environment: process.env.AAR_BENCH_ENV ?? 'local-dev',
      node: process.version,
      storage: 'MemoryAutonomousRunStore',
      sampleSize: 'TBD — run packages/autonomous benchmarks when Phase 5 is executed',
      limitations:
        'Placeholder only. Compare bootstrap with/without AutonomousModule against prior core baseline.',
    };
    expect(methodology.node).toMatch(/^v/);
  });
});
