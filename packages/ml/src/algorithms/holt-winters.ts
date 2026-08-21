/**
 * Holt-Winters exponential smoothing (additive seasonality) — pure TypeScript.
 */

export interface HoltWintersModel {
  alpha: number;
  beta: number;
  gamma: number;
  seasonLength: number;
  level: number;
  trend: number;
  seasonals: number[];
  lastValues: number[];
}

export class HoltWinters {
  private alpha: number;
  private beta: number;
  private gamma: number;
  private seasonLength: number;
  private level = 0;
  private trend = 0;
  private seasonals: number[] = [];
  private lastValues: number[] = [];
  private fitted = false;

  constructor(
    options: {
      alpha?: number;
      beta?: number;
      gamma?: number;
      seasonLength?: number;
    } = {}
  ) {
    this.alpha = options.alpha ?? 0.3;
    this.beta = options.beta ?? 0.1;
    this.gamma = options.gamma ?? 0.2;
    this.seasonLength = options.seasonLength ?? 7;
  }

  fit(series: number[]): this {
    if (series.length < this.seasonLength * 2) {
      throw new Error(`Need at least ${this.seasonLength * 2} points for Holt-Winters`);
    }

    // Initialize seasonals from first two seasons
    const seasonAverages: number[] = [];
    for (let s = 0; s < 2; s++) {
      let sum = 0;
      for (let i = 0; i < this.seasonLength; i++) {
        sum += series[s * this.seasonLength + i];
      }
      seasonAverages.push(sum / this.seasonLength);
    }

    this.seasonals = [];
    for (let i = 0; i < this.seasonLength; i++) {
      this.seasonals.push(series[i] - seasonAverages[0]);
    }

    this.level = seasonAverages[0];
    this.trend = (seasonAverages[1] - seasonAverages[0]) / this.seasonLength;

    for (let t = 0; t < series.length; t++) {
      const value = series[t];
      const seasonIndex = t % this.seasonLength;
      const lastLevel = this.level;
      const lastTrend = this.trend;
      const lastSeason = this.seasonals[seasonIndex];

      this.level = this.alpha * (value - lastSeason) + (1 - this.alpha) * (lastLevel + lastTrend);
      this.trend = this.beta * (this.level - lastLevel) + (1 - this.beta) * lastTrend;
      this.seasonals[seasonIndex] =
        this.gamma * (value - this.level) + (1 - this.gamma) * lastSeason;
    }

    this.lastValues = [...series];
    this.fitted = true;
    return this;
  }

  /** Forecast `horizon` steps ahead */
  forecast(horizon: number): number[] {
    if (!this.fitted) throw new Error('HoltWinters not fitted');
    const out: number[] = [];
    for (let h = 1; h <= horizon; h++) {
      const seasonIndex = (this.lastValues.length + h - 1) % this.seasonLength;
      out.push(this.level + h * this.trend + this.seasonals[seasonIndex]);
    }
    return out;
  }

  /** One-step ahead fitted values for in-sample evaluation */
  fittedValues(): number[] {
    if (!this.fitted) throw new Error('HoltWinters not fitted');
    // Refit walk for simplicity on a copy
    const hw = new HoltWinters({
      alpha: this.alpha,
      beta: this.beta,
      gamma: this.gamma,
      seasonLength: this.seasonLength,
    });
    const series = this.lastValues;
    hw.fit(series.slice(0, this.seasonLength * 2));
    const preds: number[] = new Array(this.seasonLength * 2).fill(NaN);
    for (let t = this.seasonLength * 2; t < series.length; t++) {
      preds.push(hw.forecast(1)[0]);
      // update with actual
      const value = series[t];
      const seasonIndex = t % this.seasonLength;
      const lastLevel = hw.level;
      const lastTrend = hw.trend;
      const lastSeason = hw.seasonals[seasonIndex];
      hw.level = hw.alpha * (value - lastSeason) + (1 - hw.alpha) * (lastLevel + lastTrend);
      hw.trend = hw.beta * (hw.level - lastLevel) + (1 - hw.beta) * lastTrend;
      hw.seasonals[seasonIndex] = hw.gamma * (value - hw.level) + (1 - hw.gamma) * lastSeason;
      hw.lastValues.push(value);
    }
    return preds;
  }

  toJSON(): HoltWintersModel {
    return {
      alpha: this.alpha,
      beta: this.beta,
      gamma: this.gamma,
      seasonLength: this.seasonLength,
      level: this.level,
      trend: this.trend,
      seasonals: this.seasonals,
      lastValues: this.lastValues,
    };
  }

  static fromJSON(model: HoltWintersModel): HoltWinters {
    const hw = new HoltWinters({
      alpha: model.alpha,
      beta: model.beta,
      gamma: model.gamma,
      seasonLength: model.seasonLength,
    });
    hw.level = model.level;
    hw.trend = model.trend;
    hw.seasonals = model.seasonals;
    hw.lastValues = model.lastValues;
    hw.fitted = true;
    return hw;
  }
}
