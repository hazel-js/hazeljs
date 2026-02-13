/**
 * Investigator agent tests (stub implementation)
 */

import { runInvestigatorAgent, formatResponseWithCitations } from '../src';

describe('runInvestigatorAgent', () => {
  it('returns stub response', async () => {
    const res = await runInvestigatorAgent({ caseId: 'c1', question: 'What happened?' });
    expect(res.summary).toContain('c1');
    expect(res.keyFactors).toContain('Placeholder - no actual analysis performed');
    expect(res.confidence).toBe(0);
    expect(res.citations).toEqual([]);
  });
});

describe('formatResponseWithCitations', () => {
  it('formats with no sources', () => {
    const res = formatResponseWithCitations({
      summary: 'x',
      keyFactors: ['a'],
      confidence: 0,
      citations: [],
      suggestedActions: ['do'],
    });
    expect(res).toContain('No sources available');
  });

  it('formats with citations', () => {
    const res = formatResponseWithCitations({
      summary: 'x',
      keyFactors: ['a'],
      confidence: 1,
      citations: [{ sourceId: 's1', excerpt: 'y' }],
      suggestedActions: [],
    });
    expect(res).toContain('[s1]');
  });
});
