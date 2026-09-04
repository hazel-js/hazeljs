import { createAIForecastProvider } from '../forecast/ai-forecast-provider';

describe('AI forecast provider', () => {
  it('parses LLM JSON forecast', async () => {
    const provider = createAIForecastProvider({
      complete: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ predictedValue: 420, confidence: 0.88 })),
    });

    const result = await provider.forecast(
      'requests',
      [{ metric: 'requests', value: 100, timestamp: Date.now() }],
      30 * 60_000
    );

    expect(result?.predictedValue).toBe(420);
    expect(result?.model).toBe('ai');
  });
});
