/**
 * Binary / one-vs-rest logistic regression with SGD — pure TypeScript.
 */

export interface LogisticRegressionModel {
  classes: string[];
  weights: number[][];
  biases: number[];
  nFeatures: number;
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export class LogisticRegression {
  private classes: string[] = [];
  private weights: number[][] = [];
  private biases: number[] = [];
  private fitted = false;

  constructor(
    private readonly options: {
      learningRate?: number;
      epochs?: number;
      l2?: number;
      batchSize?: number;
    } = {}
  ) {}

  fit(X: number[][], y: string[]): this {
    if (X.length === 0 || X.length !== y.length) {
      throw new Error('X and y must be non-empty and same length');
    }
    const nFeatures = X[0].length;
    this.classes = [...new Set(y)].sort();
    const lr = this.options.learningRate ?? 0.1;
    const epochs = this.options.epochs ?? 50;
    const l2 = this.options.l2 ?? 0.01;
    const batchSize = this.options.batchSize ?? 32;

    this.weights = this.classes.map(() => new Array(nFeatures).fill(0));
    this.biases = this.classes.map(() => 0);

    for (let epoch = 0; epoch < epochs; epoch++) {
      const indices = Array.from({ length: X.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let start = 0; start < indices.length; start += batchSize) {
        const batch = indices.slice(start, start + batchSize);
        for (let ci = 0; ci < this.classes.length; ci++) {
          const cls = this.classes[ci];
          const gradW = new Array(nFeatures).fill(0);
          let gradB = 0;

          for (const idx of batch) {
            const x = X[idx];
            const target = y[idx] === cls ? 1 : 0;
            let z = this.biases[ci];
            for (let j = 0; j < nFeatures; j++) z += this.weights[ci][j] * x[j];
            const pred = sigmoid(z);
            const err = pred - target;
            for (let j = 0; j < nFeatures; j++) gradW[j] += err * x[j];
            gradB += err;
          }

          const n = batch.length;
          for (let j = 0; j < nFeatures; j++) {
            this.weights[ci][j] -= lr * (gradW[j] / n + l2 * this.weights[ci][j]);
          }
          this.biases[ci] -= lr * (gradB / n);
        }
      }
    }

    this.fitted = true;
    return this;
  }

  predictProba(x: number[]): Record<string, number> {
    if (!this.fitted) throw new Error('LogisticRegression not fitted');
    const scores = this.classes.map((_, ci) => {
      let z = this.biases[ci];
      for (let j = 0; j < x.length; j++) z += this.weights[ci][j] * x[j];
      return z;
    });
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const result: Record<string, number> = {};
    this.classes.forEach((c, i) => {
      result[c] = exps[i] / sum;
    });
    return result;
  }

  predict(x: number[]): string {
    const proba = this.predictProba(x);
    return Object.entries(proba).sort((a, b) => b[1] - a[1])[0][0];
  }

  predictBatch(X: number[][]): string[] {
    return X.map((x) => this.predict(x));
  }

  toJSON(): LogisticRegressionModel {
    return {
      classes: this.classes,
      weights: this.weights,
      biases: this.biases,
      nFeatures: this.weights[0]?.length ?? 0,
    };
  }

  static fromJSON(model: LogisticRegressionModel): LogisticRegression {
    const lr = new LogisticRegression();
    lr.classes = model.classes;
    lr.weights = model.weights;
    lr.biases = model.biases;
    lr.fitted = true;
    return lr;
  }
}
