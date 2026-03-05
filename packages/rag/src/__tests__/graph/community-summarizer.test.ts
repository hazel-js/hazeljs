import { CommunitySummarizer } from '../../graph/community-summarizer';
import { GraphStore } from '../../graph/knowledge-graph';
import type { GraphCommunity } from '../../graph/graph.types';

function makeStore(): GraphStore {
  const store = new GraphStore();
  store.addEntity({
    id: 'e1',
    name: 'TypeScript',
    type: 'TECHNOLOGY',
    description: 'Typed JS.',
    sourceDocIds: [],
  });
  store.addEntity({
    id: 'e2',
    name: 'JavaScript',
    type: 'TECHNOLOGY',
    description: 'Web scripting language.',
    sourceDocIds: [],
  });
  store.addRelationship({
    id: 'r1',
    sourceId: 'e1',
    targetId: 'e2',
    type: 'EXTENDS',
    description: 'TS extends JS.',
    weight: 9,
    sourceDocIds: [],
  });
  return store;
}

const VALID_REPORT = JSON.stringify({
  title: 'TypeScript Ecosystem',
  summary: 'This community covers TypeScript and JavaScript.',
  findings: ['TypeScript is statically typed.', 'JavaScript is dynamic.'],
  rating: 8,
});

describe('CommunitySummarizer', () => {
  const community: GraphCommunity = { id: 'c1', entityIds: ['e1', 'e2'], level: 0 };

  it('returns empty array for no communities', async () => {
    const llm = jest.fn();
    const summarizer = new CommunitySummarizer({ llm });
    const result = await summarizer.summarizeAll([], makeStore());
    expect(result).toHaveLength(0);
    expect(llm).not.toHaveBeenCalled();
  });

  it('generates a report for a community', async () => {
    const llm = jest.fn().mockResolvedValue(VALID_REPORT);
    const summarizer = new CommunitySummarizer({ llm });
    const reports = await summarizer.summarizeAll([community], makeStore());
    expect(reports).toHaveLength(1);
    expect(reports[0].communityId).toBe('c1');
    expect(reports[0].title).toBe('TypeScript Ecosystem');
    expect(reports[0].rating).toBe(8);
    expect(reports[0].findings).toHaveLength(2);
  });

  it('strips markdown fences from LLM response', async () => {
    const withFences = `\`\`\`json\n${VALID_REPORT}\n\`\`\``;
    const llm = jest.fn().mockResolvedValue(withFences);
    const summarizer = new CommunitySummarizer({ llm });
    const reports = await summarizer.summarizeAll([community], makeStore());
    expect(reports[0].title).toBe('TypeScript Ecosystem');
  });

  it('falls back to regex extraction when JSON has prefix text', async () => {
    const messy = `Here is the JSON: ${VALID_REPORT}`;
    const llm = jest.fn().mockResolvedValue(messy);
    const summarizer = new CommunitySummarizer({ llm });
    const reports = await summarizer.summarizeAll([community], makeStore());
    expect(reports[0].title).toBe('TypeScript Ecosystem');
  });

  it('uses fallback report when LLM fails', async () => {
    const llm = jest.fn().mockRejectedValue(new Error('LLM unavailable'));
    const summarizer = new CommunitySummarizer({ llm });
    const reports = await summarizer.summarizeAll([community], makeStore());
    expect(reports).toHaveLength(1);
    expect(reports[0].communityId).toBe('c1');
    expect(reports[0].rating).toBe(5); // fallback default
    expect(reports[0].title).toContain('Community:');
  });

  it('uses fallback when LLM returns invalid JSON', async () => {
    const llm = jest.fn().mockResolvedValue('not valid json');
    const summarizer = new CommunitySummarizer({ llm });
    const reports = await summarizer.summarizeAll([community], makeStore());
    expect(reports[0].title).toContain('Community:');
  });

  it('clamps rating to 1-10', async () => {
    const resp = JSON.stringify({ title: 'T', summary: 'S', findings: [], rating: 999 });
    const llm = jest.fn().mockResolvedValue(resp);
    const summarizer = new CommunitySummarizer({ llm });
    const reports = await summarizer.summarizeAll([community], makeStore());
    expect(reports[0].rating).toBe(10);
  });

  it('respects concurrency limit when processing multiple communities', async () => {
    const communities: GraphCommunity[] = [
      { id: 'c1', entityIds: ['e1'], level: 0 },
      { id: 'c2', entityIds: ['e2'], level: 0 },
      { id: 'c3', entityIds: ['e1', 'e2'], level: 0 },
    ];
    let callCount = 0;
    const llm = jest.fn().mockImplementation(async () => {
      callCount++;
      return VALID_REPORT;
    });
    const summarizer = new CommunitySummarizer({ llm, concurrency: 2 });
    const reports = await summarizer.summarizeAll(communities, makeStore());
    expect(reports).toHaveLength(3);
    expect(callCount).toBe(3);
  });

  it('handles community with missing entities gracefully', async () => {
    const communityWithMissing: GraphCommunity = {
      id: 'cx',
      entityIds: ['nonexistent1', 'nonexistent2'],
      level: 0,
    };
    const llm = jest.fn().mockResolvedValue(VALID_REPORT);
    const summarizer = new CommunitySummarizer({ llm });
    const reports = await summarizer.summarizeAll([communityWithMissing], makeStore());
    expect(reports).toHaveLength(1);
  });

  it('includes relationship descriptions in the prompt', async () => {
    let capturedPrompt = '';
    const llm = jest.fn().mockImplementation(async (prompt: string) => {
      capturedPrompt = prompt;
      return VALID_REPORT;
    });
    const summarizer = new CommunitySummarizer({ llm });
    await summarizer.summarizeAll([community], makeStore());
    expect(capturedPrompt).toContain('EXTENDS');
  });
});
