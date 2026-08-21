/**
 * Isolation Forest — anomaly detection, pure TypeScript.
 */

export interface IsolationForestModel {
  trees: IsolationTree[];
  nFeatures: number;
  sampleSize: number;
}

interface IsolationTree {
  root: IsolationNode;
}

interface IsolationNode {
  feature?: number;
  split?: number;
  left?: IsolationNode;
  right?: IsolationNode;
  size?: number;
  depth?: number;
}

export class IsolationForest {
  private trees: IsolationTree[] = [];
  private nFeatures = 0;
  private sampleSize = 0;
  private fitted = false;

  constructor(
    private readonly options: {
      nEstimators?: number;
      maxSamples?: number;
      maxDepth?: number;
      contamination?: number;
      randomSeed?: number;
    } = {}
  ) {}

  private rng: () => number = Math.random;

  fit(X: number[][]): this {
    if (X.length === 0) throw new Error('X cannot be empty');
    this.nFeatures = X[0].length;
    const nEstimators = this.options.nEstimators ?? 100;
    const maxSamples = Math.min(this.options.maxSamples ?? 256, X.length);
    this.sampleSize = maxSamples;
    const maxDepth = this.options.maxDepth ?? Math.ceil(Math.log2(maxSamples));

    let seed = this.options.randomSeed ?? 42;
    this.rng = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    this.trees = [];
    for (let t = 0; t < nEstimators; t++) {
      const sample = this.sampleRows(X, maxSamples);
      this.trees.push({ root: this.buildTree(sample, 0, maxDepth) });
    }
    this.fitted = true;
    return this;
  }

  private sampleRows(X: number[][], n: number): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < n; i++) {
      out.push(X[Math.floor(this.rng() * X.length)]);
    }
    return out;
  }

  private buildTree(X: number[][], depth: number, maxDepth: number): IsolationNode {
    if (X.length <= 1 || depth >= maxDepth) {
      return { size: X.length, depth };
    }
    const feature = Math.floor(this.rng() * this.nFeatures);
    let min = Infinity;
    let max = -Infinity;
    for (const row of X) {
      const v = row[feature];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === max) {
      return { size: X.length, depth };
    }
    const split = min + this.rng() * (max - min);
    const left = X.filter((r) => r[feature] < split);
    const right = X.filter((r) => r[feature] >= split);
    return {
      feature,
      split,
      left: this.buildTree(left, depth + 1, maxDepth),
      right: this.buildTree(right, depth + 1, maxDepth),
    };
  }

  private pathLength(x: number[], node: IsolationNode, depth = 0): number {
    if (node.feature === undefined || node.split === undefined) {
      return depth + this.cFactor(node.size ?? 1);
    }
    if (x[node.feature] < node.split) {
      return this.pathLength(x, node.left!, depth + 1);
    }
    return this.pathLength(x, node.right!, depth + 1);
  }

  private cFactor(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }

  /** Lower score = more anomalous. Score in roughly [0,1]; < 0.5 often anomalous. */
  score(x: number[]): number {
    if (!this.fitted) throw new Error('IsolationForest not fitted');
    const avgPath =
      this.trees.reduce((sum, t) => sum + this.pathLength(x, t.root), 0) / this.trees.length;
    const c = this.cFactor(this.sampleSize);
    return Math.pow(2, -avgPath / c);
  }

  scoreBatch(X: number[][]): number[] {
    return X.map((x) => this.score(x));
  }

  predict(x: number[]): -1 | 1 {
    const contamination = this.options.contamination ?? 0.1;
    // Use score threshold: higher anomaly score → outlier (-1)
    return this.score(x) >= 0.5 + contamination * 0.3 ? -1 : 1;
  }

  predictBatch(X: number[][]): Array<-1 | 1> {
    const scores = this.scoreBatch(X);
    const sorted = [...scores].sort((a, b) => b - a);
    const contamination = this.options.contamination ?? 0.1;
    const cutoffIdx = Math.max(0, Math.floor(contamination * sorted.length) - 1);
    const threshold = sorted[cutoffIdx] ?? 0.5;
    return scores.map((s) => (s >= threshold ? -1 : 1));
  }

  toJSON(): IsolationForestModel {
    return { trees: this.trees, nFeatures: this.nFeatures, sampleSize: this.sampleSize };
  }

  static fromJSON(model: IsolationForestModel): IsolationForest {
    const forest = new IsolationForest();
    forest.trees = model.trees;
    forest.nFeatures = model.nFeatures;
    forest.sampleSize = model.sampleSize;
    forest.fitted = true;
    return forest;
  }
}
