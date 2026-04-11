import { evaluateRetrieval, answerContextOverlap } from './rag-metrics';

describe('rag-metrics', () => {
  it('evaluateRetrieval aggregates metrics', () => {
    const m = evaluateRetrieval({
      query: 'q',
      retrievedIds: ['a', 'b', 'c'],
      relevantIds: ['a', 'x'],
      k: 2,
    });
    expect(m.precisionAtK).toBe(0.5);
    expect(m.recallAtK).toBe(0.5);
    expect(m.mrr).toBe(1);
    expect(m.ndcgAtK).toBeGreaterThan(0);
  });

  it('evaluateRetrieval defaults k to 5', () => {
    const m = evaluateRetrieval({
      query: 'q',
      retrievedIds: ['a'],
      relevantIds: ['a'],
    });
    expect(m.precisionAtK).toBe(1);
  });

  it('answerContextOverlap', () => {
    expect(answerContextOverlap('Hello world test', 'The hello world is here')).toBeGreaterThan(0);
  });

  it('answerContextOverlap returns 0 for empty token side', () => {
    expect(answerContextOverlap('a', 'xyz')).toBe(0);
  });

  it('answerContextOverlap strips short tokens', () => {
    expect(answerContextOverlap('hi', 'no match here for short')).toBe(0);
  });
});
