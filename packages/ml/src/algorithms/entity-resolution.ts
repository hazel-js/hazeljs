/**
 * Jaro-Winkler string similarity + TF-IDF blocking for entity resolution.
 */

import { TfidfVectorizer, cosineSimilarity } from './tfidf';

/** Jaro similarity in [0, 1] */
export function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const matchDistance = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

/** Jaro-Winkler similarity with prefix boost */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(a, b);
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  let prefix = 0;
  const maxPrefix = Math.min(4, s1.length, s2.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * prefixScale * (1 - jaro);
}

export interface MatchCandidate {
  leftIndex: number;
  rightIndex: number;
  score: number;
  left: string;
  right: string;
}

export interface EntityResolverModel {
  threshold: number;
  blockThreshold: number;
  vectorizer: ReturnType<TfidfVectorizer['toJSON']> | null;
}

/**
 * Entity resolver: TF-IDF blocking to reduce pairs, then Jaro-Winkler scoring.
 */
export class EntityResolver {
  private threshold: number;
  private blockThreshold: number;
  private vectorizer = new TfidfVectorizer({ maxFeatures: 2000 });
  private fitted = false;

  constructor(options: { threshold?: number; blockThreshold?: number } = {}) {
    this.threshold = options.threshold ?? 0.88;
    this.blockThreshold = options.blockThreshold ?? 0.15;
  }

  /**
   * Fit TF-IDF on the combined corpus (used for blocking).
   */
  fit(records: string[]): this {
    if (records.length === 0) throw new Error('records cannot be empty');
    this.vectorizer.fit(records);
    this.fitted = true;
    return this;
  }

  /**
   * Find duplicate pairs within a single list.
   */
  findDuplicates(records: string[]): MatchCandidate[] {
    return this.match(records, records).filter((m) => m.leftIndex < m.rightIndex);
  }

  /**
   * Match left records against right records.
   */
  match(left: string[], right: string[]): MatchCandidate[] {
    if (!this.fitted) {
      this.fit([...left, ...right]);
    }
    const leftVecs = this.vectorizer.transform(left);
    const rightVecs = this.vectorizer.transform(right);
    const results: MatchCandidate[] = [];

    for (let i = 0; i < left.length; i++) {
      for (let j = 0; j < right.length; j++) {
        if (left === right && i === j) continue;
        const blockScore = cosineSimilarity(leftVecs[i], rightVecs[j]);
        if (blockScore < this.blockThreshold) continue;
        const score = jaroWinkler(left[i], right[j]);
        if (score >= this.threshold) {
          results.push({
            leftIndex: i,
            rightIndex: j,
            score,
            left: left[i],
            right: right[j],
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  similarity(a: string, b: string): number {
    return jaroWinkler(a, b);
  }

  toJSON(): EntityResolverModel {
    return {
      threshold: this.threshold,
      blockThreshold: this.blockThreshold,
      vectorizer: this.fitted ? this.vectorizer.toJSON() : null,
    };
  }

  static fromJSON(model: EntityResolverModel): EntityResolver {
    const r = new EntityResolver({
      threshold: model.threshold,
      blockThreshold: model.blockThreshold,
    });
    if (model.vectorizer) {
      r.vectorizer = TfidfVectorizer.fromJSON(model.vectorizer);
      r.fitted = true;
    }
    return r;
  }
}
