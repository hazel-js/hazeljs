import { runGenerator } from './generator-registry';

describe('generator-registry', () => {
  it('returns a helpful error for unknown generator types', async () => {
    const result = await runGenerator('nope', 'x', { dryRun: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown generator type');
  });
});

