import { ForecastProvider, ForecastResult, MetricName, MetricSample } from '../types';
import { runForecastModel } from './forecast-engine';

export interface AILlmForecastClient {
  complete(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<string>;
}

/**
 * Optional LLM-based forecast hook (Phase 2 bridge for @hazeljs/ai).
 */
export function createAIForecastProvider(client: AILlmForecastClient): ForecastProvider {
  return {
    async forecast(
      metric: MetricName,
      samples: MetricSample[],
      horizonMs: number
    ): Promise<ForecastResult | null> {
      const prompt = [
        'Predict the next metric value as JSON: {"predictedValue": number, "confidence": 0-1}',
        `Metric: ${metric}`,
        `HorizonMs: ${horizonMs}`,
        `Samples: ${JSON.stringify(samples.slice(-50))}`,
      ].join('\n');

      const content = await client.complete([
        {
          role: 'system',
          content: 'You are a time-series forecasting assistant. Respond with JSON only.',
        },
        { role: 'user', content: prompt },
      ]);

      try {
        const parsed = JSON.parse(content.trim()) as {
          predictedValue?: number;
          confidence?: number;
        };
        if (typeof parsed.predictedValue !== 'number') {
          return null;
        }
        return {
          metric,
          predictedValue: parsed.predictedValue,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
          horizonMs,
          model: 'ai',
          at: Date.now(),
        };
      } catch {
        return null;
      }
    },
  };
}

export class ForecastEngine {
  constructor(
    private readonly model: import('../types').ForecastModel = 'time-series-forecast',
    private readonly provider?: ForecastProvider
  ) {}

  async forecast(
    metric: MetricName,
    samples: MetricSample[],
    horizonMs: number
  ): Promise<ForecastResult> {
    if (this.provider) {
      const aiResult = await this.provider.forecast(metric, samples, horizonMs);
      if (aiResult) {
        return aiResult;
      }
    }

    return runForecastModel(this.model, metric, samples, horizonMs);
  }
}
