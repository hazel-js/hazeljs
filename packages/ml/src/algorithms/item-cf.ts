/**
 * Item-item collaborative filtering via cosine similarity — pure TypeScript.
 *
 * Input: user→item ratings matrix (sparse as Record<userId, Record<itemId, score>>)
 */

export interface ItemCFModel {
  itemIds: string[];
  similarity: number[][];
  itemVectors: Record<string, Record<string, number>>;
}

export class ItemItemCF {
  private itemIds: string[] = [];
  private similarity: number[][] = [];
  private itemVectors: Record<string, Record<string, number>> = {};
  private fitted = false;

  fit(userItemRatings: Record<string, Record<string, number>>): this {
    const itemSet = new Set<string>();
    for (const ratings of Object.values(userItemRatings)) {
      for (const item of Object.keys(ratings)) itemSet.add(item);
    }
    this.itemIds = [...itemSet].sort();

    // item → user → rating
    this.itemVectors = {};
    for (const item of this.itemIds) this.itemVectors[item] = {};
    for (const [user, ratings] of Object.entries(userItemRatings)) {
      for (const [item, score] of Object.entries(ratings)) {
        this.itemVectors[item][user] = score;
      }
    }

    const n = this.itemIds.length;
    this.similarity = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      this.similarity[i][i] = 1;
      for (let j = i + 1; j < n; j++) {
        const sim = this.cosineSparse(
          this.itemVectors[this.itemIds[i]],
          this.itemVectors[this.itemIds[j]]
        );
        this.similarity[i][j] = sim;
        this.similarity[j][i] = sim;
      }
    }

    this.fitted = true;
    return this;
  }

  private cosineSparse(a: Record<string, number>, b: Record<string, number>): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const v of Object.values(a)) na += v * v;
    for (const v of Object.values(b)) nb += v * v;
    for (const [k, va] of Object.entries(a)) {
      if (k in b) dot += va * b[k];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  /** Top-N similar items for a given item */
  similarItems(itemId: string, n = 5): Array<{ itemId: string; score: number }> {
    if (!this.fitted) throw new Error('ItemItemCF not fitted');
    const idx = this.itemIds.indexOf(itemId);
    if (idx < 0) return [];
    return this.itemIds
      .map((id, j) => ({ itemId: id, score: this.similarity[idx][j] }))
      .filter((x) => x.itemId !== itemId)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  /**
   * Recommend items for a user based on their rated items.
   */
  recommend(userRatings: Record<string, number>, n = 5): Array<{ itemId: string; score: number }> {
    if (!this.fitted) throw new Error('ItemItemCF not fitted');
    const scores = new Map<string, number>();
    const norms = new Map<string, number>();

    for (const [ratedItem, rating] of Object.entries(userRatings)) {
      const similar = this.similarItems(ratedItem, 20);
      for (const { itemId, score } of similar) {
        if (itemId in userRatings) continue;
        scores.set(itemId, (scores.get(itemId) ?? 0) + score * rating);
        norms.set(itemId, (norms.get(itemId) ?? 0) + Math.abs(score));
      }
    }

    return [...scores.entries()]
      .map(([itemId, raw]) => ({
        itemId,
        score: raw / (norms.get(itemId) || 1),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  toJSON(): ItemCFModel {
    return {
      itemIds: this.itemIds,
      similarity: this.similarity,
      itemVectors: this.itemVectors,
    };
  }

  static fromJSON(model: ItemCFModel): ItemItemCF {
    const cf = new ItemItemCF();
    cf.itemIds = model.itemIds;
    cf.similarity = model.similarity;
    cf.itemVectors = model.itemVectors;
    cf.fitted = true;
    return cf;
  }
}
