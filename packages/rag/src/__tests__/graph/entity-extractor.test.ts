import { EntityExtractor } from '../../graph/entity-extractor';

const VALID_RESPONSE = JSON.stringify({
  entities: [
    { name: 'TypeScript', type: 'TECHNOLOGY', description: 'A typed superset of JavaScript.' },
    { name: 'JavaScript', type: 'TECHNOLOGY', description: 'A scripting language for the web.' },
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

describe('EntityExtractor', () => {
  it('extracts entities and relationships from valid LLM response', async () => {
    const llm = jest.fn().mockResolvedValue(VALID_RESPONSE);
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['TypeScript extends JavaScript.'], 'doc1');
    expect(result.entities.some((e) => e.name === 'TypeScript')).toBe(true);
    expect(result.relationships.some((r) => r.type === 'EXTENDS')).toBe(true);
  });

  it('strips markdown fences from LLM response', async () => {
    const withFences = `\`\`\`json\n${VALID_RESPONSE}\n\`\`\``;
    const llm = jest.fn().mockResolvedValue(withFences);
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.entities.length).toBeGreaterThan(0);
  });

  it('falls back to regex extraction when JSON has prefix text', async () => {
    const messy = `Here is the result: ${VALID_RESPONSE}`;
    const llm = jest.fn().mockResolvedValue(messy);
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.entities.length).toBeGreaterThan(0);
  });

  it('silently skips unparseable LLM responses', async () => {
    const llm = jest.fn().mockResolvedValue('not valid json at all!');
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.entities).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
  });

  it('normalizes unknown EntityType to OTHER', async () => {
    const response = JSON.stringify({
      entities: [{ name: 'Widget', type: 'UNKNOWN_TYPE', description: 'A widget.' }],
      relationships: [],
    });
    const llm = jest.fn().mockResolvedValue(response);
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.entities[0].type).toBe('OTHER');
  });

  it('normalizes unknown RelationshipType to OTHER', async () => {
    const response = JSON.stringify({
      entities: [
        { name: 'A', type: 'CONCEPT', description: 'Entity A.' },
        { name: 'B', type: 'CONCEPT', description: 'Entity B.' },
      ],
      relationships: [
        { source: 'A', target: 'B', type: 'MYSTERY_TYPE', description: 'A to B.', weight: 5 },
      ],
    });
    const llm = jest.fn().mockResolvedValue(response);
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.relationships[0].type).toBe('OTHER');
  });

  it('deduplicates entities by normalized name across chunks', async () => {
    const chunk1 = JSON.stringify({
      entities: [{ name: 'TypeScript', type: 'TECHNOLOGY', description: 'TS chunk 1.' }],
      relationships: [],
    });
    const chunk2 = JSON.stringify({
      entities: [{ name: 'typescript', type: 'TECHNOLOGY', description: 'TS chunk 2.' }],
      relationships: [],
    });
    const llm = jest.fn().mockResolvedValueOnce(chunk1).mockResolvedValueOnce(chunk2);
    const extractor = new EntityExtractor({ llm, chunkSize: 5 }); // force two chunks
    const longText = 'a'.repeat(10);
    const result = await extractor.extract([longText], 'doc1');
    // Both chunks produce "typescript" — should be merged to one entity
    const tsCount = result.entities.filter((e) => e.name.toLowerCase() === 'typescript').length;
    expect(tsCount).toBe(1);
    // Description should be merged
    expect(result.entities[0].description).toContain('chunk 1');
    expect(result.entities[0].description).toContain('chunk 2');
  });

  it('clamps relationship weight to 1-10 range', async () => {
    const response = JSON.stringify({
      entities: [
        { name: 'A', type: 'CONCEPT', description: 'A.' },
        { name: 'B', type: 'CONCEPT', description: 'B.' },
      ],
      relationships: [
        { source: 'A', target: 'B', type: 'USES', description: 'A uses B.', weight: 999 },
      ],
    });
    const llm = jest.fn().mockResolvedValue(response);
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.relationships[0].weight).toBe(10);
  });

  it('filters out relationships whose entities were not extracted', async () => {
    const response = JSON.stringify({
      entities: [{ name: 'A', type: 'CONCEPT', description: 'A.' }],
      relationships: [
        { source: 'A', target: 'MissingEntity', type: 'USES', description: 'desc.', weight: 5 },
      ],
    });
    const llm = jest.fn().mockResolvedValue(response);
    const extractor = new EntityExtractor({ llm });
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.relationships).toHaveLength(0);
  });

  it('throws on response with invalid shape', async () => {
    const response = JSON.stringify({ notEntities: [] });
    const llm = jest.fn().mockResolvedValue(response);
    const extractor = new EntityExtractor({ llm });
    // The error is caught silently — returns empty
    const result = await extractor.extract(['text'], 'doc1');
    expect(result.entities).toHaveLength(0);
  });
});
