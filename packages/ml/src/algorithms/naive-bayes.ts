/**
 * Multinomial Naive Bayes classifier — pure TypeScript.
 */

export interface NaiveBayesModel {
  classes: string[];
  classLogPrior: number[];
  featureLogProb: number[][];
  vocabularySize: number;
}

export class NaiveBayesClassifier {
  private classes: string[] = [];
  private classLogPrior: number[] = [];
  private featureLogProb: number[][] = [];
  private fitted = false;

  fit(X: number[][], y: string[], alpha = 1.0): this {
    if (X.length === 0 || X.length !== y.length) {
      throw new Error('X and y must be non-empty and same length');
    }
    const vocabSize = X[0].length;
    const classCounts = new Map<string, number>();
    for (const label of y) {
      classCounts.set(label, (classCounts.get(label) ?? 0) + 1);
    }
    this.classes = [...classCounts.keys()].sort();
    const n = y.length;
    this.classLogPrior = this.classes.map((c) => Math.log((classCounts.get(c) ?? 0) / n));

    this.featureLogProb = this.classes.map((cls) => {
      const featureSum = new Array(vocabSize).fill(0);
      let total = 0;
      for (let i = 0; i < X.length; i++) {
        if (y[i] !== cls) continue;
        for (let j = 0; j < vocabSize; j++) {
          featureSum[j] += X[i][j];
          total += X[i][j];
        }
      }
      const denom = total + alpha * vocabSize;
      return featureSum.map((s) => Math.log((s + alpha) / denom));
    });

    this.fitted = true;
    return this;
  }

  predictProba(x: number[]): Record<string, number> {
    if (!this.fitted) throw new Error('NaiveBayesClassifier not fitted');
    const logScores = this.classes.map((_, ci) => {
      let score = this.classLogPrior[ci];
      for (let j = 0; j < x.length; j++) {
        if (x[j] > 0) score += x[j] * this.featureLogProb[ci][j];
      }
      return score;
    });
    const maxLog = Math.max(...logScores);
    const exps = logScores.map((s) => Math.exp(s - maxLog));
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

  toJSON(): NaiveBayesModel {
    return {
      classes: this.classes,
      classLogPrior: this.classLogPrior,
      featureLogProb: this.featureLogProb,
      vocabularySize: this.featureLogProb[0]?.length ?? 0,
    };
  }

  static fromJSON(model: NaiveBayesModel): NaiveBayesClassifier {
    const nb = new NaiveBayesClassifier();
    nb.classes = model.classes;
    nb.classLogPrior = model.classLogPrior;
    nb.featureLogProb = model.featureLogProb;
    nb.fitted = true;
    return nb;
  }
}
