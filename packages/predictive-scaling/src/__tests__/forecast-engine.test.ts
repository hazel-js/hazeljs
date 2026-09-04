import { forecastExponentialSmoothing, forecastSeasonalPattern } from '../forecast/forecast-engine';

describe('Forecast engine', () => {
  it('forecasts upward trend', () => {
    const base = Date.now() - 10 * 60_000;
    const samples = Array.from({ length: 10 }, (_, index) => ({
      metric: 'requests',
      value: 100 + index * 20,
      timestamp: base + index * 60_000,
    }));

    const forecast = forecastExponentialSmoothing('requests', samples, 30 * 60_000);

    expect(forecast.predictedValue).toBeGreaterThan(250);
    expect(forecast.confidence).toBeGreaterThan(0);
  });

  it('uses seasonal buckets', () => {
    const now = Date.now();
    const samples = [
      { metric: 'requests', value: 200, timestamp: now - 7 * 24 * 60 * 60_000 },
      { metric: 'requests', value: 220, timestamp: now - 6 * 24 * 60 * 60_000 },
    ];

    const forecast = forecastSeasonalPattern('requests', samples, 60_000);
    expect(forecast.predictedValue).toBeGreaterThan(0);
  });
});
