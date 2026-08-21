/**
 * CART decision tree (classification) — pure TypeScript, small depth.
 */

export interface TreeNode {
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  label?: string;
  proba?: Record<string, number>;
}

export interface DecisionTreeModel {
  root: TreeNode;
  maxDepth: number;
  minSamplesSplit: number;
  featureNames?: string[];
}

export class DecisionTreeClassifier {
  private root: TreeNode | null = null;
  private maxDepth: number;
  private minSamplesSplit: number;
  private fitted = false;

  constructor(options: { maxDepth?: number; minSamplesSplit?: number } = {}) {
    this.maxDepth = options.maxDepth ?? 5;
    this.minSamplesSplit = options.minSamplesSplit ?? 2;
  }

  fit(X: number[][], y: string[]): this {
    if (X.length === 0 || X.length !== y.length) {
      throw new Error('X and y must be non-empty and same length');
    }
    this.root = this.build(X, y, 0);
    this.fitted = true;
    return this;
  }

  private build(X: number[][], y: string[], depth: number): TreeNode {
    const proba = this.classProba(y);
    const majority = Object.entries(proba).sort((a, b) => b[1] - a[1])[0][0];

    if (depth >= this.maxDepth || X.length < this.minSamplesSplit || new Set(y).size === 1) {
      return { label: majority, proba };
    }

    const split = this.bestSplit(X, y);
    if (!split) {
      return { label: majority, proba };
    }

    const leftX: number[][] = [];
    const leftY: string[] = [];
    const rightX: number[][] = [];
    const rightY: string[] = [];
    for (let i = 0; i < X.length; i++) {
      if (X[i][split.feature] <= split.threshold) {
        leftX.push(X[i]);
        leftY.push(y[i]);
      } else {
        rightX.push(X[i]);
        rightY.push(y[i]);
      }
    }

    if (leftX.length === 0 || rightX.length === 0) {
      return { label: majority, proba };
    }

    return {
      feature: split.feature,
      threshold: split.threshold,
      left: this.build(leftX, leftY, depth + 1),
      right: this.build(rightX, rightY, depth + 1),
    };
  }

  private classProba(y: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const label of y) counts[label] = (counts[label] ?? 0) + 1;
    const n = y.length || 1;
    const proba: Record<string, number> = {};
    for (const [k, v] of Object.entries(counts)) proba[k] = v / n;
    return proba;
  }

  private gini(y: string[]): number {
    const proba = this.classProba(y);
    let impurity = 1;
    for (const p of Object.values(proba)) impurity -= p * p;
    return impurity;
  }

  private bestSplit(X: number[][], y: string[]): { feature: number; threshold: number } | null {
    const nFeatures = X[0].length;
    let bestGain = 0;
    let best: { feature: number; threshold: number } | null = null;
    const parentGini = this.gini(y);

    for (let f = 0; f < nFeatures; f++) {
      const values = [...new Set(X.map((row) => row[f]))].sort((a, b) => a - b);
      for (let i = 0; i < values.length - 1; i++) {
        const threshold = (values[i] + values[i + 1]) / 2;
        const leftY: string[] = [];
        const rightY: string[] = [];
        for (let r = 0; r < X.length; r++) {
          if (X[r][f] <= threshold) leftY.push(y[r]);
          else rightY.push(y[r]);
        }
        if (leftY.length === 0 || rightY.length === 0) continue;
        const gain =
          parentGini -
          (leftY.length / y.length) * this.gini(leftY) -
          (rightY.length / y.length) * this.gini(rightY);
        if (gain > bestGain) {
          bestGain = gain;
          best = { feature: f, threshold };
        }
      }
    }
    return best;
  }

  predictProba(x: number[]): Record<string, number> {
    if (!this.fitted || !this.root) throw new Error('DecisionTreeClassifier not fitted');
    let node = this.root;
    while (node.feature !== undefined && node.threshold !== undefined) {
      node = x[node.feature] <= node.threshold ? node.left! : node.right!;
    }
    return { ...(node.proba ?? { [node.label ?? '']: 1 }) };
  }

  predict(x: number[]): string {
    const proba = this.predictProba(x);
    return Object.entries(proba).sort((a, b) => b[1] - a[1])[0][0];
  }

  predictBatch(X: number[][]): string[] {
    return X.map((x) => this.predict(x));
  }

  toJSON(): DecisionTreeModel {
    if (!this.root) throw new Error('Not fitted');
    return {
      root: this.root,
      maxDepth: this.maxDepth,
      minSamplesSplit: this.minSamplesSplit,
    };
  }

  static fromJSON(model: DecisionTreeModel): DecisionTreeClassifier {
    const tree = new DecisionTreeClassifier({
      maxDepth: model.maxDepth,
      minSamplesSplit: model.minSamplesSplit,
    });
    tree.root = model.root;
    tree.fitted = true;
    return tree;
  }
}
