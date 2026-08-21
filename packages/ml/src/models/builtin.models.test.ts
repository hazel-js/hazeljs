import {
  TextNaiveBayesModel,
  TextLogisticRegressionModel,
  IsolationForestModel,
  CosineKnnModel,
  ItemItemCFModel,
  EntityResolverModel,
  HoltWintersModel,
  KMeansModel,
  DecisionTreeModel,
} from './builtin.models';

describe('built-in models', () => {
  describe('TextNaiveBayesModel', () => {
    it('trains and predicts', async () => {
      const model = new TextNaiveBayesModel();
      await expect(model.predict({ text: 'x' })).rejects.toThrow('not trained');
      const result = await model.train({
        samples: [
          { text: 'good great love', label: 'pos' },
          { text: 'bad terrible hate', label: 'neg' },
          { text: 'good love', label: 'pos' },
          { text: 'awful bad', label: 'neg' },
        ],
      });
      expect(result.accuracy).toBeGreaterThan(0.5);
      const pred = await model.predict({ text: 'good love' });
      expect(pred.label).toBe('pos');
      expect(pred.scores).toBeDefined();
    });

    it('rejects empty training data', async () => {
      await expect(new TextNaiveBayesModel().train({ samples: [] })).rejects.toThrow(
        'Training data must include samples'
      );
    });
  });

  describe('TextLogisticRegressionModel', () => {
    it('trains and predicts', async () => {
      const model = new TextLogisticRegressionModel();
      await expect(model.predict({ text: 'x' })).rejects.toThrow('not trained');
      await model.train({
        data: [
          { text: 'good great', label: 'pos' },
          { text: 'bad awful', label: 'neg' },
          { text: 'love good', label: 'pos' },
          { text: 'hate bad', label: 'neg' },
        ],
      });
      const pred = await model.predict({ text: 'good' });
      expect(['pos', 'neg']).toContain(pred.label);
    });
  });

  describe('IsolationForestModel', () => {
    it('trains on feature rows and scores anomalies', async () => {
      const model = new IsolationForestModel();
      await expect(model.predict({ features: [0, 0] })).rejects.toThrow('not trained');
      await model.train({
        X: Array.from({ length: 30 }, () => [Math.random(), Math.random()]),
      });
      const pred = await model.predict({ features: [0.5, 0.5] });
      expect([-1, 1]).toContain(pred.label);
      expect(typeof pred.score).toBe('number');
    });

    it('accepts samples with features objects', async () => {
      const model = new IsolationForestModel();
      await model.train({
        samples: [{ features: [0, 0] }, { features: [0.1, 0.1] }, { features: [1, 1] }],
      });
      await expect(model.predict({ features: [0, 0] })).resolves.toBeDefined();
    });

    it('rejects empty rows', async () => {
      await expect(new IsolationForestModel().train({ samples: [] })).rejects.toThrow(
        'numeric feature rows'
      );
    });
  });

  describe('CosineKnnModel', () => {
    it('trains and returns neighbors', async () => {
      const model = new CosineKnnModel();
      await expect(model.predict({ text: 'x' })).rejects.toThrow('not trained');
      await model.train({
        samples: [
          { text: 'alpha beta', label: 'a' },
          { text: 'gamma delta', label: 'b' },
          { text: 'alpha gamma', label: 'a' },
        ],
        k: 1,
      });
      const pred = await model.predict({ text: 'alpha beta', k: 1 });
      expect(pred.label).toBeDefined();
      expect(pred.neighbors.length).toBeGreaterThan(0);
    });
  });

  describe('ItemItemCFModel', () => {
    it('recommends and finds similar items', async () => {
      const model = new ItemItemCFModel();
      await expect(model.predict({ userRatings: { a: 5 } })).rejects.toThrow('not trained');
      await model.train({
        ratings: {
          u1: { a: 5, b: 4 },
          u2: { a: 5, b: 5, c: 1 },
          u3: { b: 4, c: 2 },
        },
      });
      const similar = await model.predict({ itemId: 'a', n: 2 });
      expect(similar.similar?.length).toBeGreaterThan(0);
      const recs = await model.predict({ userRatings: { a: 5 }, n: 2 });
      expect(recs.recommendations?.length).toBeGreaterThan(0);
      await expect(model.predict({})).rejects.toThrow('Provide userRatings or itemId');
    });

    it('rejects missing ratings', async () => {
      await expect(new ItemItemCFModel().train({})).rejects.toThrow('ratings');
    });
  });

  describe('EntityResolverModel', () => {
    it('matches pairs, lists, and similarity', async () => {
      const model = new EntityResolverModel();
      await expect(model.predict({ a: 'x', b: 'y' })).rejects.toThrow('not trained');
      await model.train({
        records: ['Acme Corp', 'ACME Corporation', 'Globex Inc'],
        threshold: 0.8,
        blockThreshold: 0.05,
      });
      const sim = await model.predict({ a: 'Acme Corp', b: 'Acme Corporation' });
      expect(sim.score!).toBeGreaterThan(0.8);
      const dups = await model.predict({
        records: ['Acme Corp', 'Acme Corporation', 'Other'],
      });
      expect(dups.matches).toBeDefined();
      const cross = await model.predict({
        left: ['Acme Corp'],
        right: ['ACME Corporation'],
      });
      expect(cross.matches).toBeDefined();
      await expect(model.predict({})).rejects.toThrow('Provide a+b');
    });

    it('accepts sample objects and rejects empty', async () => {
      const model = new EntityResolverModel();
      await model.train({ samples: [{ text: 'Ada Lovelace' }, { text: 'Ada L.' }] });
      await expect(model.train({ records: [] })).rejects.toThrow('records or samples');
    });
  });

  describe('HoltWintersModel', () => {
    it('forecasts a seasonal series', async () => {
      const model = new HoltWintersModel();
      await expect(model.predict({})).rejects.toThrow('not trained');
      const season = [10, 12, 14, 13, 11, 9, 8];
      const series = [...season, ...season.map((v) => v + 1), ...season.map((v) => v + 2)];
      await model.train({ series, seasonLength: 7 });
      const out = await model.predict({ horizon: 3 });
      expect(out.forecast).toHaveLength(3);
      await expect(model.train({ values: [] })).rejects.toThrow('series');
    });
  });

  describe('KMeansModel', () => {
    it('clusters and returns centroids', async () => {
      const model = new KMeansModel();
      await expect(model.predict({ features: [0, 0] })).rejects.toThrow('not trained');
      await model.train({
        samples: [
          [0, 0],
          [0.1, 0.1],
          [5, 5],
          [5.1, 4.9],
        ],
        k: 2,
      });
      const pred = await model.predict({ features: [0, 0] });
      expect(pred.cluster).toBeGreaterThanOrEqual(0);
      expect(pred.centroids).toHaveLength(2);
      await expect(model.train({ X: [] })).rejects.toThrow('numeric feature rows');
    });
  });

  describe('DecisionTreeModel', () => {
    it('classifies tabular samples', async () => {
      const model = new DecisionTreeModel();
      await expect(model.predict({ features: [0, 0] })).rejects.toThrow('not trained');
      const result = await model.train({
        samples: [
          { features: [0, 0], label: 'a' },
          { features: [0, 1], label: 'a' },
          { features: [1, 0], label: 'b' },
          { features: [1, 1], label: 'b' },
        ],
        maxDepth: 3,
      });
      expect(result.accuracy).toBeGreaterThan(0.5);
      const pred = await model.predict({ features: [0, 0] });
      expect(pred.label).toBe('a');
      await expect(model.train({ samples: [] })).rejects.toThrow('features, label');
    });
  });
});
