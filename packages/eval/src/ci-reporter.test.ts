import { reportEvalForCi } from './ci-reporter';
import type { EvalRunResult } from './types';

describe('ci-reporter', () => {
  const baseResult = (): EvalRunResult => ({
    datasetName: 'ds',
    datasetVersion: '1',
    caseResults: [
      { caseId: 'c1', passed: true, score: 1 },
      { caseId: 'c2', passed: false, score: 0.2, error: 'boom' },
    ],
    averageScore: 0.6,
    passed: false,
  });

  it('logs summary and cases', () => {
    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    reportEvalForCi(baseResult());
    spy.mockRestore();
    expect(logs.some((l) => l.includes('hazeljs/eval'))).toBe(true);
    expect(logs.some((l) => l.includes('c1'))).toBe(true);
    expect(logs.some((l) => l.includes('error=boom'))).toBe(true);
  });

  it('sets exitCode when exitOnFail and failed', () => {
    const prev = process.exitCode;
    process.exitCode = undefined;
    reportEvalForCi(baseResult(), { exitOnFail: true });
    expect(process.exitCode).toBe(1);
    process.exitCode = prev;
  });

  it('does not set exitCode when passed', () => {
    const prev = process.exitCode;
    process.exitCode = undefined;
    reportEvalForCi(
      {
        ...baseResult(),
        passed: true,
      },
      { exitOnFail: true }
    );
    expect(process.exitCode).toBeUndefined();
    process.exitCode = prev;
  });
});
