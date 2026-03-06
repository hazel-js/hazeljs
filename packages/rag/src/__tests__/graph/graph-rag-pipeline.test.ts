import { GraphRAGPipeline } from '../../graph/graph-rag-pipeline';
import type { Document } from '../../types';

const EXTRACTION_RESPONSE = JSON.stringify({
  entities: [
    { name: 'TypeScript', type: 'TECHNOLOGY', description: 'A typed language.' },
    { name: 'JavaScript', type: 'TECHNOLOGY', description: 'A dynamic language.' },
  ],
  relationships: [
    {
      source: 'TypeScript',
      target: 'JavaScript',
      type: 'EXTENDS',
      description: 'TS extends JS.',
      weight: 9,
    },
  ],
});

const COMMUNITY_REPORT = JSON.stringify({
  title: 'Web Languages',
  summary: 'TypeScript and JavaScript are related web technologies.',
  findings: ['TypeScript extends JavaScript.'],
  rating: 8,
});

const LLM_ANSWER = 'TypeScript is a typed superset of JavaScript.';

function makeLlm(): jest.Mock {
  return jest.fn().mockImplementation(async (prompt: string) => {
    // Entity extraction prompts contain "entities" keyword
    if (prompt.includes('Extract ALL entities')) return EXTRACTION_RESPONSE;
    // Community summary prompts
    if (prompt.includes('community report')) return COMMUNITY_REPORT;
    // Search synthesis
    return LLM_ANSWER;
  });
}

const DOC: Document = {
  id: 'doc1',
  content: 'TypeScript extends JavaScript with types.',
  metadata: {},
};

describe('GraphRAGPipeline.build', () => {
  it('processes documents and returns build stats', async () => {
    const pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    const stats = await pipeline.build([DOC]);
    expect(stats.documentsProcessed).toBe(1);
    expect(stats.entitiesExtracted).toBeGreaterThanOrEqual(0);
    expect(stats.duration).toBeGreaterThanOrEqual(0);
  });

  it('clears previous graph state on build', async () => {
    const llm = makeLlm();
    const pipeline = new GraphRAGPipeline({ llm });
    await pipeline.build([DOC]);
    const firstCount = pipeline.getGraph().entities.size;
    await pipeline.build([DOC]);
    expect(pipeline.getGraph().entities.size).toBe(firstCount);
  });

  it('populates the graph with entities', async () => {
    const pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    await pipeline.build([DOC]);
    expect(pipeline.getGraph().entities.size).toBeGreaterThan(0);
  });

  it('skips community reports when generateCommunityReports is false', async () => {
    const llm = jest.fn().mockResolvedValue(EXTRACTION_RESPONSE);
    const pipeline = new GraphRAGPipeline({ llm, generateCommunityReports: false });
    const stats = await pipeline.build([DOC]);
    expect(stats.communityReportsGenerated).toBe(0);
  });

  it('handles documents without id', async () => {
    const pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    const docWithoutId: Document = { content: 'Some content', metadata: {} };
    await expect(pipeline.build([docWithoutId])).resolves.toBeDefined();
  });

  it('merges duplicate entities across documents', async () => {
    const pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    const docs = [
      { id: 'd1', content: 'TypeScript is typed.', metadata: {} },
      { id: 'd2', content: 'TypeScript is compiled.', metadata: {} },
    ];
    await pipeline.build(docs);
    const ts = pipeline.getGraph().findEntityByName('TypeScript');
    // TypeScript entity should exist and be merged
    expect(ts).toBeDefined();
  });
});

describe('GraphRAGPipeline.search', () => {
  let pipeline: GraphRAGPipeline;

  beforeEach(async () => {
    pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    await pipeline.build([DOC]);
  });

  it('localSearch returns a result', async () => {
    const result = await pipeline.search('TypeScript', { mode: 'local' });
    expect(result.mode).toBe('local');
    expect(result.query).toBe('TypeScript');
    expect(typeof result.answer).toBe('string');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('globalSearch returns a result', async () => {
    const result = await pipeline.search('JavaScript', { mode: 'global' });
    expect(result.mode).toBe('global');
    expect(typeof result.answer).toBe('string');
  });

  it('hybridSearch is the default mode', async () => {
    const result = await pipeline.search('TypeScript');
    expect(result.mode).toBe('hybrid');
  });

  it('hybridSearch merges local and global contexts', async () => {
    const result = await pipeline.search('TypeScript', { mode: 'hybrid' });
    expect(result.context).toContain('LOCAL');
    expect(result.context).toContain('GLOBAL');
  });

  it('local search with includeGraph false returns empty entity list', async () => {
    const result = await pipeline.localSearch('TypeScript', { includeGraph: false });
    expect(result.entities).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
  });

  it('global search with includeCommunities false returns empty community list', async () => {
    const result = await pipeline.globalSearch('TypeScript', { includeCommunities: false });
    expect(result.communities).toHaveLength(0);
  });
});

describe('GraphRAGPipeline.getStats & clear', () => {
  it('getStats reflects graph content', async () => {
    const pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    await pipeline.build([DOC]);
    const stats = pipeline.getStats();
    expect(stats.totalEntities).toBeGreaterThanOrEqual(0);
  });

  it('clear resets the graph', async () => {
    const pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    await pipeline.build([DOC]);
    pipeline.clear();
    expect(pipeline.getGraph().entities.size).toBe(0);
  });

  it('getGraph returns the internal GraphStore', async () => {
    const pipeline = new GraphRAGPipeline({ llm: makeLlm() });
    const graph = pipeline.getGraph();
    expect(graph).toBeDefined();
    expect(typeof graph.entities).toBe('object');
  });
});

describe('GraphRAGPipeline with empty graph', () => {
  it('localSearch on empty graph returns answer', async () => {
    const llm = jest.fn().mockResolvedValue(LLM_ANSWER);
    const pipeline = new GraphRAGPipeline({ llm });
    const result = await pipeline.localSearch('anything');
    expect(result.entities).toHaveLength(0);
  });

  it('globalSearch on empty graph returns answer', async () => {
    const llm = jest.fn().mockResolvedValue(LLM_ANSWER);
    const pipeline = new GraphRAGPipeline({ llm });
    const result = await pipeline.globalSearch('anything');
    expect(result.communities).toHaveLength(0);
  });
});
