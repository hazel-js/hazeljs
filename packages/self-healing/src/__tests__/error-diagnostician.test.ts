import { ErrorDiagnostician } from '../diagnosis/error-diagnostician';

describe('ErrorDiagnostician', () => {
  const diagnostician = new ErrorDiagnostician();

  it('classifies connection errors as dependency issues', () => {
    const result = diagnostician.ruleBasedDiagnose(
      Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })
    );

    expect(result.category).toBe('dependency');
    expect(result.suggestedStrategies).toContain('auto-restart');
  });

  it('classifies config errors', () => {
    const result = diagnostician.ruleBasedDiagnose(
      Object.assign(new Error('Invalid config'), { code: 'EINVAL' })
    );

    expect(result.category).toBe('config');
    expect(result.suggestedStrategies).toContain('config-rollback');
  });

  it('classifies memory errors', () => {
    const result = diagnostician.ruleBasedDiagnose(new Error('JavaScript heap out of memory'));

    expect(result.category).toBe('memory');
    expect(result.suggestedStrategies).toContain('memory-cleanup');
  });

  it('uses AI provider when available', async () => {
    const ai = {
      diagnose: jest.fn().mockResolvedValue({
        category: 'unknown' as const,
        confidence: 1,
        message: 'AI diagnosis',
        suggestedStrategies: ['safe-mode' as const],
      }),
    };

    const withAi = new ErrorDiagnostician(ai);
    const result = await withAi.diagnose(new Error('anything'));

    expect(ai.diagnose).toHaveBeenCalled();
    expect(result.message).toBe('AI diagnosis');
  });
});
