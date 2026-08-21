/**
 * k-means clustering with k-means++ initialization — pure TypeScript.
 */

export interface KMeansModel {
  k: number;
  centroids: number[][];
  inertia: number;
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export class KMeans {
  private k: number;
  private maxIter: number;
  private centroids: number[][] = [];
  private inertia = 0;
  private fitted = false;
  private rng: () => number;

  constructor(options: { k?: number; maxIter?: number; seed?: number } = {}) {
    this.k = options.k ?? 3;
    this.maxIter = options.maxIter ?? 100;
    let seed = options.seed ?? 42;
    this.rng = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  fit(X: number[][]): this {
    if (X.length === 0) throw new Error('X cannot be empty');
    if (this.k > X.length) throw new Error('k cannot exceed number of samples');

    this.centroids = this.initPlusPlus(X);

    for (let iter = 0; iter < this.maxIter; iter++) {
      const clusters: number[][][] = Array.from({ length: this.k }, () => []);
      for (const point of X) {
        const label = this.closestCentroid(point);
        clusters[label].push(point);
      }

      let moved = false;
      for (let c = 0; c < this.k; c++) {
        if (clusters[c].length === 0) continue;
        const dim = X[0].length;
        const newCentroid = new Array(dim).fill(0);
        for (const p of clusters[c]) {
          for (let d = 0; d < dim; d++) newCentroid[d] += p[d];
        }
        for (let d = 0; d < dim; d++) newCentroid[d] /= clusters[c].length;
        if (euclidean(newCentroid, this.centroids[c]) > 1e-9) moved = true;
        this.centroids[c] = newCentroid;
      }
      if (!moved) break;
    }

    this.inertia = 0;
    for (const point of X) {
      const c = this.closestCentroid(point);
      this.inertia += euclidean(point, this.centroids[c]) ** 2;
    }

    this.fitted = true;
    return this;
  }

  private initPlusPlus(X: number[][]): number[][] {
    const centroids: number[][] = [];
    centroids.push([...X[Math.floor(this.rng() * X.length)]]);

    while (centroids.length < this.k) {
      const distances = X.map((p) => {
        let min = Infinity;
        for (const c of centroids) {
          const d = euclidean(p, c) ** 2;
          if (d < min) min = d;
        }
        return min;
      });
      const sum = distances.reduce((a, b) => a + b, 0);
      let r = this.rng() * sum;
      let idx = 0;
      for (let i = 0; i < distances.length; i++) {
        r -= distances[i];
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      centroids.push([...X[idx]]);
    }
    return centroids;
  }

  private closestCentroid(point: number[]): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.centroids.length; i++) {
      const d = euclidean(point, this.centroids[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  predict(x: number[]): number {
    if (!this.fitted) throw new Error('KMeans not fitted');
    return this.closestCentroid(x);
  }

  predictBatch(X: number[][]): number[] {
    return X.map((x) => this.predict(x));
  }

  getCentroids(): number[][] {
    return this.centroids.map((c) => [...c]);
  }

  getInertia(): number {
    return this.inertia;
  }

  toJSON(): KMeansModel {
    return { k: this.k, centroids: this.centroids, inertia: this.inertia };
  }

  static fromJSON(model: KMeansModel): KMeans {
    const km = new KMeans({ k: model.k });
    km.centroids = model.centroids;
    km.inertia = model.inertia;
    km.fitted = true;
    return km;
  }
}
