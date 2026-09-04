import {
  createAIDiagnosticsProvider,
  parseDiagnosisJson,
} from '../diagnosis/ai-diagnostics-provider';

describe('AI diagnostics provider', () => {
  it('parses valid diagnosis JSON', () => {
    const result = parseDiagnosisJson(
      JSON.stringify({
        category: 'dependency',
        confidence: 0.9,
        message: 'Payment gateway unreachable',
        suggestedStrategies: ['pod-restart', 'auto-restart'],
      })
    );

    expect(result?.category).toBe('dependency');
    expect(result?.suggestedStrategies).toContain('pod-restart');
  });

  it('calls LLM client and returns diagnosis', async () => {
    const provider = createAIDiagnosticsProvider({
      complete: jest.fn().mockResolvedValue(
        JSON.stringify({
          category: 'config',
          confidence: 0.8,
          message: 'Invalid timeout configuration',
          suggestedStrategies: ['config-rollback'],
        })
      ),
    });

    const result = await provider.diagnose(new Error('EINVAL'), { target: 'App.config' });

    expect(result?.category).toBe('config');
    expect(result?.message).toContain('timeout');
  });
});
