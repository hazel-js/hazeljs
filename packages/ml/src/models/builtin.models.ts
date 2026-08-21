/**
 * Built-in @Model wrappers around pure-TS algorithms.
 */

import { Injectable } from '@hazeljs/core';
import { Model, Train, Predict } from '../decorators';
import type { TrainingData, TrainingResult } from '../ml.types';
import { TfidfVectorizer } from '../algorithms/tfidf';
import { NaiveBayesClassifier } from '../algorithms/naive-bayes';
import { LogisticRegression } from '../algorithms/logistic-regression';
import { IsolationForest } from '../algorithms/isolation-forest';
import { CosineKnn } from '../algorithms/cosine-knn';
import { ItemItemCF } from '../algorithms/item-cf';
import { EntityResolver } from '../algorithms/entity-resolution';
import { HoltWinters } from '../algorithms/holt-winters';
import { KMeans } from '../algorithms/kmeans';
import { DecisionTreeClassifier } from '../algorithms/decision-tree';

function extractTextSamples(data: TrainingData): { texts: string[]; labels: string[] } {
  const samples = (data.samples ?? data.data ?? []) as Array<{
    text?: string;
    label?: string;
    features?: number[];
  }>;
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Training data must include samples: [{ text, label }, ...]');
  }
  return {
    texts: samples.map((s) => String(s.text ?? '')),
    labels: samples.map((s) => String(s.label ?? '')),
  };
}

@Model({
  name: 'text-naive-bayes',
  version: '1.0.0',
  framework: 'custom',
  description: 'TF-IDF + Multinomial Naive Bayes text classifier',
  tags: ['nlp', 'classification', 'builtin'],
})
@Injectable()
export class TextNaiveBayesModel {
  private vectorizer = new TfidfVectorizer({ maxFeatures: 5000 });
  private classifier = new NaiveBayesClassifier();
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const { texts, labels } = extractTextSamples(data);
    const X = this.vectorizer.fitTransform(texts);
    this.classifier.fit(X, labels);
    this.trained = true;
    const preds = this.classifier.predictBatch(X);
    const accuracy = preds.filter((p, i) => p === labels[i]).length / labels.length;
    return { accuracy, metrics: { accuracy } };
  }

  @Predict()
  async predict(input: { text: string }): Promise<{
    label: string;
    confidence: number;
    scores: Record<string, number>;
  }> {
    if (!this.trained) throw new Error('Model not trained');
    const x = this.vectorizer.transformOne(input.text);
    const scores = this.classifier.predictProba(x);
    const label = this.classifier.predict(x);
    return { label, confidence: scores[label] ?? 0, scores };
  }
}

@Model({
  name: 'text-logistic-regression',
  version: '1.0.0',
  framework: 'custom',
  description: 'TF-IDF + Logistic Regression text classifier',
  tags: ['nlp', 'classification', 'builtin'],
})
@Injectable()
export class TextLogisticRegressionModel {
  private vectorizer = new TfidfVectorizer({ maxFeatures: 5000 });
  private classifier = new LogisticRegression({ epochs: 40, learningRate: 0.2 });
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const { texts, labels } = extractTextSamples(data);
    const X = this.vectorizer.fitTransform(texts);
    this.classifier.fit(X, labels);
    this.trained = true;
    const preds = this.classifier.predictBatch(X);
    const accuracy = preds.filter((p, i) => p === labels[i]).length / labels.length;
    return { accuracy, metrics: { accuracy } };
  }

  @Predict()
  async predict(input: { text: string }): Promise<{
    label: string;
    confidence: number;
    scores: Record<string, number>;
  }> {
    if (!this.trained) throw new Error('Model not trained');
    const x = this.vectorizer.transformOne(input.text);
    const scores = this.classifier.predictProba(x);
    const label = this.classifier.predict(x);
    return { label, confidence: scores[label] ?? 0, scores };
  }
}

@Model({
  name: 'isolation-forest',
  version: '1.0.0',
  framework: 'custom',
  description: 'Isolation Forest anomaly detector',
  tags: ['anomaly', 'fraud', 'builtin'],
})
@Injectable()
export class IsolationForestModel {
  private forest = new IsolationForest({ nEstimators: 50, maxSamples: 128, contamination: 0.1 });
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const samples = (data.samples ?? data.X ?? []) as number[][] | Array<{ features: number[] }>;
    const X: number[][] = Array.isArray(samples[0])
      ? (samples as number[][])
      : (samples as Array<{ features: number[] }>).map((s) => s.features);
    if (!X.length) throw new Error('Training data must include numeric feature rows');
    this.forest.fit(X);
    this.trained = true;
    return { metrics: { nSamples: X.length } };
  }

  @Predict()
  async predict(input: { features: number[] }): Promise<{
    anomaly: boolean;
    score: number;
    label: -1 | 1;
  }> {
    if (!this.trained) throw new Error('Model not trained');
    const score = this.forest.score(input.features);
    const label = this.forest.predict(input.features);
    return { anomaly: label === -1, score, label };
  }
}

@Model({
  name: 'cosine-knn',
  version: '1.0.0',
  framework: 'custom',
  description: 'TF-IDF cosine k-NN classifier / similarity search',
  tags: ['nlp', 'similarity', 'builtin'],
})
@Injectable()
export class CosineKnnModel {
  private vectorizer = new TfidfVectorizer({ maxFeatures: 5000 });
  private knn = new CosineKnn(5);
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const { texts, labels } = extractTextSamples(data);
    const X = this.vectorizer.fitTransform(texts);
    const k = typeof data.k === 'number' ? data.k : 5;
    this.knn = new CosineKnn(k);
    this.knn.fit(X, labels);
    this.trained = true;
    return { metrics: { nSamples: texts.length, k } };
  }

  @Predict()
  async predict(input: { text: string; k?: number }): Promise<{
    label: string;
    neighbors: Array<{ label: string; similarity: number }>;
  }> {
    if (!this.trained) throw new Error('Model not trained');
    const x = this.vectorizer.transformOne(input.text);
    const neighbors = this.knn.neighbors(x, input.k).map((n) => ({
      label: n.label,
      similarity: n.similarity,
    }));
    return { label: this.knn.predict(x), neighbors };
  }
}

@Model({
  name: 'item-item-cf',
  version: '1.0.0',
  framework: 'custom',
  description: 'Item-item collaborative filtering recommender',
  tags: ['recommendation', 'builtin'],
})
@Injectable()
export class ItemItemCFModel {
  private cf = new ItemItemCF();
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const ratings = (data.ratings ?? data.userItemRatings) as
      | Record<string, Record<string, number>>
      | undefined;
    if (!ratings)
      throw new Error('Training data must include ratings: { userId: { itemId: score } }');
    this.cf.fit(ratings);
    this.trained = true;
    return { metrics: { nUsers: Object.keys(ratings).length } };
  }

  @Predict()
  async predict(input: {
    userRatings?: Record<string, number>;
    itemId?: string;
    n?: number;
  }): Promise<{
    recommendations?: Array<{ itemId: string; score: number }>;
    similar?: Array<{ itemId: string; score: number }>;
  }> {
    if (!this.trained) throw new Error('Model not trained');
    const n = input.n ?? 5;
    if (input.itemId) {
      return { similar: this.cf.similarItems(input.itemId, n) };
    }
    if (input.userRatings) {
      return { recommendations: this.cf.recommend(input.userRatings, n) };
    }
    throw new Error('Provide userRatings or itemId');
  }
}

@Model({
  name: 'entity-resolver',
  version: '1.0.0',
  framework: 'custom',
  description: 'Jaro-Winkler + TF-IDF blocking entity resolution',
  tags: ['entity-resolution', 'fuzzy-match', 'builtin'],
})
@Injectable()
export class EntityResolverModel {
  private resolver = new EntityResolver();
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const records = (data.records ?? data.samples ?? []) as string[] | Array<{ text: string }>;
    const texts = Array.isArray(records)
      ? records.map((r) => (typeof r === 'string' ? r : String(r.text ?? '')))
      : [];
    if (!texts.length) throw new Error('Training data must include records or samples with text');
    const threshold = typeof data.threshold === 'number' ? data.threshold : 0.88;
    const blockThreshold = typeof data.blockThreshold === 'number' ? data.blockThreshold : 0.15;
    this.resolver = new EntityResolver({ threshold, blockThreshold });
    this.resolver.fit(texts);
    this.trained = true;
    return { metrics: { nRecords: texts.length } };
  }

  @Predict()
  async predict(input: {
    left?: string[];
    right?: string[];
    records?: string[];
    a?: string;
    b?: string;
  }): Promise<{
    matches?: Array<{
      leftIndex: number;
      rightIndex: number;
      score: number;
      left: string;
      right: string;
    }>;
    score?: number;
  }> {
    if (!this.trained) throw new Error('Model not trained');
    if (input.a !== undefined && input.b !== undefined) {
      return { score: this.resolver.similarity(input.a, input.b) };
    }
    if (input.records) {
      return { matches: this.resolver.findDuplicates(input.records) };
    }
    if (input.left && input.right) {
      return { matches: this.resolver.match(input.left, input.right) };
    }
    throw new Error('Provide a+b, records, or left+right');
  }
}

@Model({
  name: 'holt-winters',
  version: '1.0.0',
  framework: 'custom',
  description: 'Holt-Winters additive seasonal forecast',
  tags: ['forecasting', 'timeseries', 'builtin'],
})
@Injectable()
export class HoltWintersModel {
  private model = new HoltWinters();
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const series = (data.series ?? data.values ?? []) as number[];
    if (!Array.isArray(series) || series.length === 0) {
      throw new Error('Training data must include series: number[]');
    }
    const seasonLength = typeof data.seasonLength === 'number' ? data.seasonLength : 7;
    this.model = new HoltWinters({ seasonLength });
    this.model.fit(series);
    this.trained = true;
    return { metrics: { nPoints: series.length, seasonLength } };
  }

  @Predict()
  async predict(input: { horizon?: number }): Promise<{ forecast: number[] }> {
    if (!this.trained) throw new Error('Model not trained');
    return { forecast: this.model.forecast(input.horizon ?? 7) };
  }
}

@Model({
  name: 'kmeans',
  version: '1.0.0',
  framework: 'custom',
  description: 'k-means++ clustering',
  tags: ['clustering', 'segmentation', 'builtin'],
})
@Injectable()
export class KMeansModel {
  private model = new KMeans();
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const samples = (data.samples ?? data.X ?? []) as number[][] | Array<{ features: number[] }>;
    const X: number[][] = Array.isArray(samples[0])
      ? (samples as number[][])
      : (samples as Array<{ features: number[] }>).map((s) => s.features);
    if (!X.length) throw new Error('Training data must include numeric feature rows');
    const k = typeof data.k === 'number' ? data.k : 3;
    this.model = new KMeans({ k });
    this.model.fit(X);
    this.trained = true;
    return { metrics: { k, inertia: this.model.getInertia(), nSamples: X.length } };
  }

  @Predict()
  async predict(input: { features: number[] }): Promise<{
    cluster: number;
    centroids: number[][];
  }> {
    if (!this.trained) throw new Error('Model not trained');
    return {
      cluster: this.model.predict(input.features),
      centroids: this.model.getCentroids(),
    };
  }
}

@Model({
  name: 'decision-tree',
  version: '1.0.0',
  framework: 'custom',
  description: 'CART decision tree classifier',
  tags: ['classification', 'tabular', 'builtin'],
})
@Injectable()
export class DecisionTreeModel {
  private tree = new DecisionTreeClassifier({ maxDepth: 5 });
  private trained = false;

  @Train()
  async train(data: TrainingData): Promise<TrainingResult> {
    const samples = (data.samples ?? []) as Array<{ features: number[]; label: string }>;
    if (!samples.length) {
      throw new Error('Training data must include samples: [{ features, label }]');
    }
    const X = samples.map((s) => s.features);
    const y = samples.map((s) => s.label);
    const maxDepth = typeof data.maxDepth === 'number' ? data.maxDepth : 5;
    this.tree = new DecisionTreeClassifier({ maxDepth });
    this.tree.fit(X, y);
    this.trained = true;
    const preds = this.tree.predictBatch(X);
    const accuracy = preds.filter((p, i) => p === y[i]).length / y.length;
    return { accuracy, metrics: { accuracy, maxDepth } };
  }

  @Predict()
  async predict(input: { features: number[] }): Promise<{
    label: string;
    scores: Record<string, number>;
  }> {
    if (!this.trained) throw new Error('Model not trained');
    const scores = this.tree.predictProba(input.features);
    return { label: this.tree.predict(input.features), scores };
  }
}
