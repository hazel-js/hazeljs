import {
  parseJudgeScore,
  buildRelevanceJudgePrompt,
  buildFaithfulnessJudgePrompt,
} from './llm-judge';

describe('llm-judge', () => {
  it('parseJudgeScore parses raw JSON', async () => {
    const r = await parseJudgeScore('{"score":0.8,"reasoning":"ok"}');
    expect(r.score).toBe(0.8);
    expect(r.reasoning).toBe('ok');
  });

  it('parseJudgeScore strips markdown fences', async () => {
    const r = await parseJudgeScore('```json\n{"score": 0.5}\n```');
    expect(r.score).toBe(0.5);
  });

  it('parseJudgeScore clamps score to 0–1', async () => {
    const hi = await parseJudgeScore('{"score": 2}');
    expect(hi.score).toBe(1);
    const lo = await parseJudgeScore('{"score": -1}');
    expect(lo.score).toBe(0);
  });

  it('parseJudgeScore uses 0 when score missing', async () => {
    const r = await parseJudgeScore('{"reasoning":"nope"}');
    expect(r.score).toBe(0);
  });

  it('buildRelevanceJudgePrompt includes query and answer', () => {
    const p = buildRelevanceJudgePrompt('q1', 'a1');
    expect(p).toContain('q1');
    expect(p).toContain('a1');
    expect(p).toContain('JSON');
  });

  it('buildFaithfulnessJudgePrompt includes context and answer', () => {
    const p = buildFaithfulnessJudgePrompt('ctx', 'ans');
    expect(p).toContain('ctx');
    expect(p).toContain('ans');
  });
});
