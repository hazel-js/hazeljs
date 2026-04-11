import { runGoldenDataset } from './golden-runner';
import type { GoldenDataset } from './types';

describe('runGoldenDataset', () => {
  const ds = (cases: GoldenDataset['cases']): GoldenDataset => ({
    name: 'test',
    version: '1',
    cases,
  });

  it('scores expected output match', async () => {
    const r = await runGoldenDataset(
      ds([{ id: '1', input: 'q', expectedOutput: 'hello' }]),
      async () => ({ output: 'say hello world' }),
      { minAverageScore: 0.5 }
    );
    expect(r.caseResults[0].score).toBe(1);
    expect(r.passed).toBe(true);
  });

  it('scores exact case-insensitive match', async () => {
    const r = await runGoldenDataset(
      ds([{ id: '1', input: 'q', expectedOutput: 'Hello' }]),
      async () => ({ output: '  hello  ' }),
      { minAverageScore: 0.5 }
    );
    expect(r.caseResults[0].score).toBe(1);
  });

  it('scores tool trajectory', async () => {
    const r = await runGoldenDataset(
      ds([{ id: '1', input: 'q', expectedToolCalls: ['a', 'b'] }]),
      async () => ({ output: 'x', toolCalls: ['a', 'b'] }),
      { minAverageScore: 0.5 }
    );
    expect(r.caseResults[0].details?.trajectoryScore).toBe(1);
  });

  it('scores retrieval precision', async () => {
    const r = await runGoldenDataset(
      ds([{ id: '1', input: 'q', expectedRetrievedIds: ['x', 'y'] }]),
      async () => ({ output: 'o', retrievedIds: ['x', 'z'] }),
      { minAverageScore: 0.3 }
    );
    expect(r.caseResults[0].details?.precisionAt5).toBeDefined();
  });

  it('defaults score to 1 when no expectations', async () => {
    const r = await runGoldenDataset(
      ds([{ id: '1', input: 'q' }]),
      async () => ({ output: 'any' }),
      { minAverageScore: 0.5 }
    );
    expect(r.caseResults[0].score).toBe(1);
  });

  it('combines output and trajectory with average', async () => {
    const r = await runGoldenDataset(
      ds([
        {
          id: '1',
          input: 'q',
          expectedOutput: 'ok',
          expectedToolCalls: ['t'],
        },
      ]),
      async () => ({ output: 'ok done', toolCalls: ['t'] }),
      { minAverageScore: 0.5 }
    );
    expect(r.caseResults[0].score).toBe(1);
  });

  it('records runner errors', async () => {
    const r = await runGoldenDataset(
      ds([{ id: '1', input: 'q' }]),
      async () => {
        throw new Error('fail');
      },
      { minAverageScore: 0 }
    );
    expect(r.caseResults[0].error).toBe('fail');
    expect(r.passed).toBe(false);
  });

  it('runs batches with concurrency > 1', async () => {
    const r = await runGoldenDataset(
      ds([
        { id: 'a', input: '1' },
        { id: 'b', input: '2' },
      ]),
      async () => ({ output: 'x' }),
      { concurrency: 2, minAverageScore: 0 }
    );
    expect(r.caseResults).toHaveLength(2);
  });

  it('average score is 0 for empty cases', async () => {
    const r = await runGoldenDataset(ds([]), async () => ({ output: '' }), {});
    expect(r.averageScore).toBe(0);
  });

  it('fails run when minAverageScore not met', async () => {
    const r = await runGoldenDataset(
      ds([{ id: '1', input: 'q', expectedOutput: 'zzz' }]),
      async () => ({ output: 'no match' }),
      { minAverageScore: 0.99 }
    );
    expect(r.passed).toBe(false);
  });
});
