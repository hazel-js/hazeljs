/**
 * Cosine k-NN classifier / similar-item search — pure TypeScript.
 */

import { cosineSimilarity } from './tfidf';

export interface CosineKnnModel {
  X: number[][];
  y: string[];
  k: number;
}

export interface Neighbor {
  index: number;
  label: string;
  similarity: number;
}

export class CosineKnn {
  private X: number[][] = [];
  private y: string[] = [];
  private fitted = false;

  constructor(private readonly k = 5) {}

  fit(X: number[][], y: string[]): this {
    if (X.length === 0 || X.length !== y.length) {
      throw new Error('X and y must be non-empty and same length');
    }
    this.X = X.map((row) => [...row]);
    this.y = [...y];
    this.fitted = true;
    return this;
  }

  neighbors(x: number[], k?: number): Neighbor[] {
    if (!this.fitted) throw new Error('CosineKnn not fitted');
    const topK = k ?? this.k;
    const scored = this.X.map((row, index) => ({
      index,
      label: this.y[index],
      similarity: cosineSimilarity(x, row),
    }));
    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  predict(x: number[]): string {
    const neigh = this.neighbors(x);
    const votes = new Map<string, number>();
    for (const n of neigh) {
      votes.set(n.label, (votes.get(n.label) ?? 0) + n.similarity);
    }
    return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }

  predictBatch(X: number[][]): string[] {
    return X.map((x) => this.predict(x));
  }

  toJSON(): CosineKnnModel {
    return { X: this.X, y: this.y, k: this.k };
  }

  static fromJSON(model: CosineKnnModel): CosineKnn {
    const knn = new CosineKnn(model.k);
    knn.X = model.X;
    knn.y = model.y;
    knn.fitted = true;
    return knn;
  }
}
