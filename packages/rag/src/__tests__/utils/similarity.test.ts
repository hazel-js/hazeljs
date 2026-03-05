import { cosineSimilarity, euclideanDistance, dotProduct } from '../../utils/similarity';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for a zero vector', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('throws when vectors have different lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('same length');
  });

  it('computes partial similarity correctly', () => {
    const result = cosineSimilarity([1, 1], [1, 0]);
    expect(result).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns correct distance for simple vectors', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5);
  });

  it('throws when vectors have different lengths', () => {
    expect(() => euclideanDistance([1, 2], [1])).toThrow('same length');
  });
});

describe('dotProduct', () => {
  it('returns correct dot product', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(dotProduct([1, 0], [0, 1])).toBe(0);
  });

  it('throws when vectors have different lengths', () => {
    expect(() => dotProduct([1, 2], [1])).toThrow('same length');
  });
});
