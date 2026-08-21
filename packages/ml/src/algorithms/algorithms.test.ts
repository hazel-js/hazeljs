import {
  TfidfVectorizer,
  NaiveBayesClassifier,
  LogisticRegression,
  IsolationForest,
  CosineKnn,
  ItemItemCF,
  cosineSimilarity,
  jaroWinkler,
  EntityResolver,
  HoltWinters,
  KMeans,
  DecisionTreeClassifier,
} from './index';

describe('ML algorithms', () => {
  describe('TfidfVectorizer', () => {
    it('fits and transforms', () => {
      const v = new TfidfVectorizer();
      const X = v.fitTransform(['hello world', 'hello there', 'goodbye world']);
      expect(X).toHaveLength(3);
      expect(X[0].length).toBe(v.featureNames.length);
      expect(cosineSimilarity(X[0], X[0])).toBeCloseTo(1, 5);
    });
  });

  describe('NaiveBayesClassifier', () => {
    it('learns simple classes', () => {
      const v = new TfidfVectorizer();
      const texts = ['good great love', 'bad terrible hate', 'good love', 'awful bad'];
      const labels = ['pos', 'neg', 'pos', 'neg'];
      const X = v.fitTransform(texts);
      const nb = new NaiveBayesClassifier().fit(X, labels);
      expect(nb.predict(v.transformOne('good love'))).toBe('pos');
      expect(nb.predict(v.transformOne('bad hate'))).toBe('neg');
    });
  });

  describe('LogisticRegression', () => {
    it('separates linearly separable points', () => {
      const X = [
        [0, 0],
        [0.1, 0.2],
        [0.2, 0],
        [2, 2],
        [2.1, 1.9],
        [1.8, 2.2],
      ];
      const y = ['a', 'a', 'a', 'b', 'b', 'b'];
      const lr = new LogisticRegression({ epochs: 120, learningRate: 0.5, l2: 0.001 }).fit(X, y);
      expect(lr.predict([0, 0])).toBe('a');
      expect(lr.predict([2, 2])).toBe('b');
    });
  });

  describe('IsolationForest', () => {
    it('scores outliers higher', () => {
      const normal = Array.from({ length: 40 }, () => [
        Math.random(),
        Math.random(),
        Math.random(),
      ]);
      const forest = new IsolationForest({
        nEstimators: 30,
        maxSamples: 32,
        randomSeed: 1,
      }).fit(normal);
      const normalScore = forest.score([0.5, 0.5, 0.5]);
      const outlierScore = forest.score([10, 10, 10]);
      expect(outlierScore).toBeGreaterThan(normalScore);
    });
  });

  describe('CosineKnn', () => {
    it('predicts by neighbors', () => {
      const knn = new CosineKnn(1).fit(
        [
          [1, 0],
          [0, 1],
        ],
        ['x', 'y']
      );
      expect(knn.predict([0.9, 0.1])).toBe('x');
    });
  });

  describe('ItemItemCF', () => {
    it('recommends related items', () => {
      const cf = new ItemItemCF().fit({
        u1: { a: 5, b: 4 },
        u2: { a: 5, b: 5, c: 1 },
        u3: { b: 4, c: 2 },
      });
      const similar = cf.similarItems('a', 2);
      expect(similar[0].itemId).toBe('b');
      const recs = cf.recommend({ a: 5 }, 2);
      expect(recs.length).toBeGreaterThan(0);
    });
  });

  describe('EntityResolver', () => {
    it('scores similar names highly', () => {
      expect(jaroWinkler('John Smith', 'Jon Smith')).toBeGreaterThan(0.9);
      const resolver = new EntityResolver({ threshold: 0.85, blockThreshold: 0.05 });
      resolver.fit(['Acme Corp', 'ACME Corporation', 'Globex']);
      const matches = resolver.findDuplicates([
        'Acme Corporation',
        'Acme Corp',
        'Totally Different Inc',
      ]);
      expect(matches.some((m) => m.score > 0.85)).toBe(true);
    });
  });

  describe('HoltWinters', () => {
    it('forecasts seasonal series', () => {
      const season = [10, 12, 14, 13, 11, 9, 8];
      const series = [...season, ...season.map((v) => v + 1), ...season.map((v) => v + 2)];
      const hw = new HoltWinters({ seasonLength: 7 }).fit(series);
      const forecast = hw.forecast(7);
      expect(forecast).toHaveLength(7);
      expect(forecast.every((v) => Number.isFinite(v))).toBe(true);
    });
  });

  describe('KMeans', () => {
    it('clusters two blobs', () => {
      const X = [
        [0, 0],
        [0.1, 0.1],
        [0.2, 0],
        [5, 5],
        [5.1, 4.9],
        [4.8, 5.2],
      ];
      const km = new KMeans({ k: 2, seed: 1 }).fit(X);
      const labels = km.predictBatch(X);
      expect(new Set(labels).size).toBe(2);
      expect(labels[0]).toBe(labels[1]);
      expect(labels[0]).not.toBe(labels[3]);
    });
  });

  describe('DecisionTreeClassifier', () => {
    it('learns a simple rule', () => {
      const X = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [0.1, 0.2],
        [0.9, 0.8],
      ];
      const y = ['a', 'a', 'b', 'b', 'a', 'b'];
      const tree = new DecisionTreeClassifier({ maxDepth: 3 }).fit(X, y);
      expect(tree.predict([0, 0])).toBe('a');
      expect(tree.predict([1, 1])).toBe('b');
    });

    it('supports batch predict and serialization', () => {
      const tree = new DecisionTreeClassifier({ maxDepth: 2 }).fit(
        [[0], [1], [0.1], [0.9]],
        ['a', 'b', 'a', 'b']
      );
      expect(tree.predictBatch([[0], [1]])).toEqual(['a', 'b']);
      const restored = DecisionTreeClassifier.fromJSON(tree.toJSON());
      expect(restored.predict([0])).toBe('a');
    });
  });

  describe('serialization and batch helpers', () => {
    it('NaiveBayes predictProba and toJSON', () => {
      const v = new TfidfVectorizer({ maxFeatures: 20 });
      const X = v.fitTransform(['good', 'bad', 'good love', 'bad hate']);
      const nb = new NaiveBayesClassifier().fit(X, ['pos', 'neg', 'pos', 'neg']);
      const proba = nb.predictProba(v.transformOne('good'));
      expect(proba.pos).toBeGreaterThan(0);
      const restored = NaiveBayesClassifier.fromJSON(nb.toJSON());
      expect(restored.predict(v.transformOne('good'))).toBe(nb.predict(v.transformOne('good')));
      expect(nb.predictBatch(X)).toHaveLength(4);
    });

    it('LogisticRegression predictProba and batch', () => {
      const X = [
        [0, 0],
        [0.1, 0],
        [2, 2],
        [2.1, 1.9],
      ];
      const lr = new LogisticRegression({ epochs: 80, learningRate: 0.5 }).fit(X, [
        'a',
        'a',
        'b',
        'b',
      ]);
      const proba = lr.predictProba([0, 0]);
      expect(Object.keys(proba).sort()).toEqual(['a', 'b']);
      expect(lr.predictBatch(X)).toHaveLength(4);
      const restored = LogisticRegression.fromJSON(lr.toJSON());
      expect(restored.predict([0, 0])).toBe(lr.predict([0, 0]));
    });

    it('IsolationForest predictBatch and fromJSON', () => {
      const X = Array.from({ length: 20 }, () => [Math.random(), Math.random()]);
      const forest = new IsolationForest({
        nEstimators: 10,
        maxSamples: 16,
        randomSeed: 2,
        contamination: 0.1,
      }).fit(X);
      expect(forest.scoreBatch(X)).toHaveLength(20);
      expect(forest.predictBatch(X)).toHaveLength(20);
      const restored = IsolationForest.fromJSON(forest.toJSON());
      expect(restored.score(X[0])).toBeCloseTo(forest.score(X[0]), 5);
    });

    it('CosineKnn neighbors and fromJSON', () => {
      const knn = new CosineKnn(2).fit(
        [
          [1, 0],
          [0, 1],
          [0.9, 0.1],
        ],
        ['x', 'y', 'x']
      );
      expect(knn.neighbors([1, 0], 2)).toHaveLength(2);
      expect(
        knn.predictBatch([
          [1, 0],
          [0, 1],
        ])
      ).toEqual(['x', 'y']);
      const restored = CosineKnn.fromJSON(knn.toJSON());
      expect(restored.predict([1, 0])).toBe('x');
    });

    it('ItemItemCF handles unknown item and empty user', () => {
      const cf = new ItemItemCF().fit({
        u1: { a: 5, b: 4 },
        u2: { a: 5, c: 1 },
      });
      expect(cf.similarItems('missing', 3)).toEqual([]);
      expect(cf.recommend({}, 3)).toEqual([]);
      const restored = ItemItemCF.fromJSON(cf.toJSON());
      expect(restored.similarItems('a', 1)[0].itemId).toBeDefined();
    });

    it('EntityResolver match and fromJSON', () => {
      const resolver = new EntityResolver({ threshold: 0.7, blockThreshold: 0.01 });
      resolver.fit(['Ada Lovelace', 'Grace Hopper']);
      const matches = resolver.match(['Ada Lovlace'], ['Ada Lovelace', 'Other']);
      expect(matches.length).toBeGreaterThan(0);
      expect(resolver.similarity('Ada', 'Ada')).toBe(1);
      const restored = EntityResolver.fromJSON(resolver.toJSON());
      expect(restored.similarity('Ada', 'Ada')).toBe(1);
    });

    it('HoltWinters fitted values and fromJSON', () => {
      const season = [1, 2, 3, 2];
      const series = [...season, ...season, ...season, ...season];
      const hw = new HoltWinters({ seasonLength: 4 }).fit(series);
      const fitted = hw.fittedValues();
      expect(fitted.length).toBe(series.length);
      const restored = HoltWinters.fromJSON(hw.toJSON());
      expect(restored.forecast(2)).toHaveLength(2);
    });

    it('KMeans getCentroids inertia and fromJSON', () => {
      const X = [
        [0, 0],
        [0.1, 0],
        [5, 5],
        [5.1, 5],
      ];
      const km = new KMeans({ k: 2, seed: 3 }).fit(X);
      expect(km.getCentroids()).toHaveLength(2);
      expect(km.getInertia()).toBeGreaterThanOrEqual(0);
      expect(km.predictBatch(X)).toHaveLength(4);
      const restored = KMeans.fromJSON(km.toJSON());
      expect(restored.predict([0, 0])).toBe(km.predict([0, 0]));
    });

    it('TfidfVectorizer transform and empty vocab edge', () => {
      const v = new TfidfVectorizer({ maxFeatures: 2, minDf: 1 });
      v.fit(['a b c', 'a b d']);
      expect(v.transform(['a b']).length).toBe(1);
      expect(v.transformOne('').every((x) => x === 0 || Number.isFinite(x))).toBe(true);
      const restored = TfidfVectorizer.fromJSON(v.toJSON());
      expect(restored.transformOne('a').length).toBe(v.featureNames.length);
    });
  });
});
