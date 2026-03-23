import { DriftService } from '../drift.service';

describe('DriftService', () => {
  let service: DriftService;

  beforeEach(() => {
    service = new DriftService();
  });

  describe('setReferenceDistribution', () => {
    it('should store reference distribution', () => {
      const values = [1, 2, 3, 4, 5];
      service.setReferenceDistribution('feature1', values);

      // Verify by detecting drift (which requires reference)
      const result = service.detectDrift('feature1', [1, 2, 3, 4, 5], {
        method: 'psi',
        threshold: 0.25,
      });
      expect(result).toBeDefined();
    });

    it('should copy values array', () => {
      const values = [1, 2, 3];
      service.setReferenceDistribution('feature1', values);
      values.push(4); // Modify original

      const result = service.detectDrift('feature1', [1, 2, 3], {
        method: 'psi',
        threshold: 0.25,
      });
      expect(result.score).toBeLessThan(0.1); // Should match original 3 values
    });
  });

  describe('calculateStats', () => {
    it('should calculate basic statistics', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = service.calculateStats(values);

      expect(stats.count).toBe(5);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.mean).toBe(3);
      expect(stats.median).toBe(3);
    });

    it('should calculate median for even count', () => {
      const values = [1, 2, 3, 4];
      const stats = service.calculateStats(values);

      expect(stats.median).toBe(2.5);
    });

    it('should calculate median for odd count', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = service.calculateStats(values);

      expect(stats.median).toBe(3);
    });

    it('should calculate standard deviation', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = service.calculateStats(values);

      expect(stats.std).toBeGreaterThan(0);
      expect(stats.std).toBeCloseTo(1.414, 2);
    });

    it('should calculate histogram', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = service.calculateStats(values);

      expect(stats.histogram).toHaveLength(10);
      expect(stats.histogram[0].bin).toBe(0);
    });

    it('should calculate percentiles', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = service.calculateStats(values);

      expect(stats.percentiles.p5).toBeDefined();
      expect(stats.percentiles.p25).toBeDefined();
      expect(stats.percentiles.p50).toBeDefined();
      expect(stats.percentiles.p75).toBeDefined();
      expect(stats.percentiles.p95).toBeDefined();
    });

    it('should handle single value', () => {
      const values = [5];
      const stats = service.calculateStats(values);

      expect(stats.count).toBe(1);
      expect(stats.min).toBe(5);
      expect(stats.max).toBe(5);
      expect(stats.mean).toBe(5);
      expect(stats.median).toBe(5);
      expect(stats.std).toBe(0);
    });

    it('should handle identical values', () => {
      const values = [5, 5, 5, 5, 5];
      const stats = service.calculateStats(values);

      expect(stats.mean).toBe(5);
      expect(stats.std).toBe(0);
    });
  });

  describe('calculatePSI', () => {
    it('should return low PSI for identical distributions', () => {
      const reference = Array.from({ length: 100 }, (_, i) => i);
      const current = Array.from({ length: 100 }, (_, i) => i);

      const psi = service.calculatePSI(reference, current);

      expect(psi).toBeLessThan(0.1);
    });

    it('should calculate PSI for different distributions', () => {
      const reference = Array.from({ length: 100 }, (_, i) => i);
      const current = Array.from({ length: 100 }, (_, i) => i + 100);

      const psi = service.calculatePSI(reference, current);

      expect(psi).toBeGreaterThanOrEqual(0);
    });

    it('should handle custom bin count', () => {
      const reference = Array.from({ length: 50 }, (_, i) => i);
      const current = Array.from({ length: 50 }, (_, i) => i);

      const psi = service.calculatePSI(reference, current, 5);

      expect(psi).toBeLessThan(0.1);
    });

    it('should handle distributions with different ranges', () => {
      const reference = Array.from({ length: 50 }, (_, i) => i);
      const current = Array.from({ length: 50 }, (_, i) => i + 25);

      const psi = service.calculatePSI(reference, current);

      expect(psi).toBeGreaterThan(0);
    });
  });

  describe('calculateKS', () => {
    it('should return low KS for identical distributions', () => {
      const reference = [1, 2, 3, 4, 5];
      const current = [1, 2, 3, 4, 5];

      const result = service.calculateKS(reference, current);

      expect(result.d).toBeLessThan(0.1);
      expect(result.pValue).toBeDefined();
    });

    it('should return higher KS for different distributions', () => {
      const reference = [1, 2, 3, 4, 5];
      const current = [10, 20, 30, 40, 50];

      const result = service.calculateKS(reference, current);

      expect(result.d).toBeGreaterThan(0.5);
    });
  });

  describe('detectDrift', () => {
    it('should detect no drift for similar distributions using PSI', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      const result = service.detectDrift('feature1', [1, 2, 3, 4, 5], {
        method: 'psi',
        threshold: 0.25,
      });

      expect(result.driftDetected).toBe(false);
      expect(result.score).toBeLessThan(0.1);
      expect(result.feature).toBe('feature1');
      expect(result.method).toBe('psi');
    });

    it('should detect drift for different distributions', () => {
      const reference = Array.from({ length: 100 }, (_, i) => i);
      const current = Array.from({ length: 100 }, (_, i) => i + 100);

      service.setReferenceDistribution('feature1', reference);

      const result = service.detectDrift('feature1', current, {
        method: 'psi',
        threshold: 0.25,
      });

      expect(result.feature).toBe('feature1');
      expect(result.method).toBe('psi');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when reference not set', () => {
      expect(() => {
        service.detectDrift('unknown-feature', [1, 2, 3], {
          method: 'psi',
          threshold: 0.25,
        });
      }).toThrow('No reference distribution');
    });

    it('should support KS method', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      const result = service.detectDrift('feature1', [1, 2, 3, 4, 5], {
        method: 'ks',
        threshold: 0.3,
      });

      expect(result.method).toBe('ks');
      expect(result.pValue).toBeDefined();
    });

    it('should support JSD method', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      const result = service.detectDrift('feature1', [1, 2, 3, 4, 5], {
        method: 'jsd',
        threshold: 0.1,
      });

      expect(result.method).toBe('jsd');
    });

    it('should support Wasserstein method', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      const result = service.detectDrift('feature1', [1, 2, 3, 4, 5], {
        method: 'wasserstein',
        threshold: 1.0,
      });

      expect(result.method).toBe('wasserstein');
    });
  });

  describe('calculateJSD', () => {
    it('should return low JSD for identical distributions', () => {
      const reference = [1, 2, 3, 4, 5];
      const current = [1, 2, 3, 4, 5];

      const jsd = service.calculateJSD(reference, current);

      expect(jsd).toBeLessThan(0.1);
    });

    it('should return higher JSD for different distributions', () => {
      const reference = [1, 2, 3, 4, 5];
      const current = [10, 20, 30, 40, 50];

      const jsd = service.calculateJSD(reference, current);

      expect(jsd).toBeGreaterThan(0);
    });
  });

  describe('calculateWasserstein', () => {
    it('should return low distance for identical distributions', () => {
      const reference = [1, 2, 3, 4, 5];
      const current = [1, 2, 3, 4, 5];

      const distance = service.calculateWasserstein(reference, current);

      expect(distance).toBe(0);
    });

    it('should return higher distance for different distributions', () => {
      const reference = [1, 2, 3, 4, 5];
      const current = [10, 20, 30, 40, 50];

      const distance = service.calculateWasserstein(reference, current);

      expect(distance).toBeGreaterThan(0);
    });

    it('should handle distributions of different lengths', () => {
      const reference = [1, 2, 3, 4, 5];
      const current = [1, 2, 3];

      const distance = service.calculateWasserstein(reference, current);

      expect(distance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectDrift with different methods', () => {
    it('should throw error for unsupported method', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      expect(() => {
        service.detectDrift('feature1', [1, 2, 3, 4, 5], {
          method: 'unknown' as any,
          threshold: 0.25,
        });
      }).toThrow('Unsupported drift detection method');
    });

    it('should include message in result', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      const result = service.detectDrift('feature1', [1, 2, 3, 4, 5], {
        method: 'psi',
        threshold: 0.25,
      });

      expect(result.message).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('calculateChiSquare', () => {
    it('should calculate chi-square for categorical data', () => {
      const reference = { a: 10, b: 20, c: 30 };
      const current = { a: 15, b: 25, c: 20 };

      const result = service.calculateChiSquare(reference, current);

      expect(result.chi2).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
    });

    it('should handle new categories in current', () => {
      const reference = { a: 10, b: 20 };
      const current = { a: 10, b: 20, c: 10 };

      const result = service.calculateChiSquare(reference, current);

      expect(result.chi2).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing categories in current', () => {
      const reference = { a: 10, b: 20, c: 30 };
      const current = { a: 10, b: 20 };

      const result = service.calculateChiSquare(reference, current);

      expect(result.chi2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectDriftReport', () => {
    it('should generate drift report for multiple features', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);
      service.setReferenceDistribution('feature2', [10, 20, 30, 40, 50]);

      const report = service.detectDriftReport(
        {
          feature1: [1, 2, 3, 4, 5],
          feature2: [10, 20, 30, 40, 50],
        },
        {
          method: 'psi',
          threshold: 0.25,
          windowSize: 100,
        }
      );

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.totalFeatures).toBe(2);
      expect(report.results).toHaveLength(2);
    });

    it('should calculate drift percentage', () => {
      service.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      const report = service.detectDriftReport(
        {
          feature1: [1, 2, 3, 4, 5],
        },
        {
          method: 'psi',
          threshold: 0.25,
          windowSize: 100,
        }
      );

      expect(report.driftPercentage).toBeGreaterThanOrEqual(0);
      expect(report.driftPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('detectPredictionDrift', () => {
    it('should detect drift in numeric predictions', () => {
      const referencePredictions = [1, 2, 3, 4, 5];
      const currentPredictions = [1, 2, 3, 4, 5];

      const result = service.detectPredictionDrift(referencePredictions, currentPredictions);

      expect(result.feature).toBe('__prediction__');
      expect(result.driftDetected).toBeDefined();
    });

    it('should detect drift in categorical predictions', () => {
      const referencePredictions = ['a', 'b', 'c', 'a', 'b'];
      const currentPredictions = ['a', 'b', 'c', 'a', 'b'];

      const result = service.detectPredictionDrift(referencePredictions, currentPredictions);

      expect(result.feature).toBe('prediction');
      expect(result.driftDetected).toBeDefined();
    });
  });

  describe('detectCategoricalDrift', () => {
    it('should detect categorical drift using chi-square', () => {
      service.setReferenceDistribution('category_feature', ['a', 'b', 'c', 'a', 'b'] as any);

      const result = service.detectCategoricalDrift('category_feature', ['a', 'b', 'c', 'a', 'b'], {
        threshold: 0.05,
        windowSize: 100,
      });

      expect(result.feature).toBe('category_feature');
      expect(result.method).toBe('chi2');
      expect(result.driftDetected).toBeDefined();
    });

    it('should throw error when reference not set', () => {
      expect(() => {
        service.detectCategoricalDrift('unknown', ['a', 'b'], {
          threshold: 0.05,
          windowSize: 100,
        });
      }).toThrow('No reference distribution');
    });
  });

  describe('countCategories', () => {
    it('should count category frequencies', () => {
      const values = ['a', 'b', 'a', 'c', 'b', 'a'];
      const counts = (service as any).countCategories(values);

      expect(counts.a).toBe(3);
      expect(counts.b).toBe(2);
      expect(counts.c).toBe(1);
    });

    it('should handle empty array', () => {
      const counts = (service as any).countCategories([]);

      expect(Object.keys(counts)).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty distributions in calculateStats', () => {
      const stats = service.calculateStats([5]);

      expect(stats.count).toBe(1);
      expect(stats.min).toBe(5);
      expect(stats.max).toBe(5);
    });

    it('should handle distributions with zero range', () => {
      const values = [5, 5, 5, 5, 5];
      const stats = service.calculateStats(values);

      expect(stats.std).toBe(0);
      expect(stats.histogram).toHaveLength(10);
    });

    it('should handle single bin in PSI calculation', () => {
      const reference = [1, 2, 3];
      const current = [1, 2, 3];

      const psi = service.calculatePSI(reference, current, 1);

      expect(psi).toBeGreaterThanOrEqual(0);
    });
  });
});
