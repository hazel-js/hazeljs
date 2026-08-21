/**
 * TF-IDF vectorizer — pure TypeScript, no external deps.
 */

export interface TfidfModel {
  vocabulary: string[];
  idf: number[];
  vocabIndex: Record<string, number>;
}

export class TfidfVectorizer {
  private vocabulary: string[] = [];
  private idf: number[] = [];
  private vocabIndex: Record<string, number> = {};
  private fitted = false;

  constructor(
    private readonly options: {
      maxFeatures?: number;
      minDf?: number;
      tokenizer?: (text: string) => string[];
    } = {}
  ) {}

  static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  fit(documents: string[]): this {
    const tokenize = this.options.tokenizer ?? TfidfVectorizer.tokenize;
    const minDf = this.options.minDf ?? 1;
    const docTokens = documents.map((d) => tokenize(d));
    const df = new Map<string, number>();

    for (const tokens of docTokens) {
      const unique = new Set(tokens);
      for (const t of unique) {
        df.set(t, (df.get(t) ?? 0) + 1);
      }
    }

    let terms = [...df.entries()]
      .filter(([, count]) => count >= minDf)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    if (this.options.maxFeatures && terms.length > this.options.maxFeatures) {
      terms = terms.slice(0, this.options.maxFeatures);
    }

    this.vocabulary = terms.map(([t]) => t);
    this.vocabIndex = {};
    this.vocabulary.forEach((t, i) => {
      this.vocabIndex[t] = i;
    });

    const n = documents.length;
    this.idf = this.vocabulary.map((t) => {
      const count = df.get(t) ?? 0;
      return Math.log((n + 1) / (count + 1)) + 1;
    });

    this.fitted = true;
    return this;
  }

  transform(documents: string[]): number[][] {
    if (!this.fitted) throw new Error('TfidfVectorizer not fitted');
    const tokenize = this.options.tokenizer ?? TfidfVectorizer.tokenize;
    return documents.map((doc) => this.transformOne(tokenize(doc)));
  }

  transformOne(tokensOrText: string[] | string): number[] {
    if (!this.fitted) throw new Error('TfidfVectorizer not fitted');
    const tokens =
      typeof tokensOrText === 'string'
        ? (this.options.tokenizer ?? TfidfVectorizer.tokenize)(tokensOrText)
        : tokensOrText;

    const tf = new Map<string, number>();
    for (const t of tokens) {
      if (t in this.vocabIndex) tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    const vec = new Array(this.vocabulary.length).fill(0);
    const total = tokens.length || 1;
    for (const [t, count] of tf) {
      const i = this.vocabIndex[t];
      vec[i] = (count / total) * this.idf[i];
    }
    return vec;
  }

  fitTransform(documents: string[]): number[][] {
    return this.fit(documents).transform(documents);
  }

  toJSON(): TfidfModel {
    return { vocabulary: this.vocabulary, idf: this.idf, vocabIndex: this.vocabIndex };
  }

  static fromJSON(model: TfidfModel): TfidfVectorizer {
    const v = new TfidfVectorizer();
    v.vocabulary = model.vocabulary;
    v.idf = model.idf;
    v.vocabIndex = model.vocabIndex;
    v.fitted = true;
    return v;
  }

  get featureNames(): string[] {
    return [...this.vocabulary];
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
