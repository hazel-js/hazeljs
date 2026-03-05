import { GraphStore } from '../../graph/knowledge-graph';
import type { GraphEntity, GraphRelationship } from '../../graph/graph.types';

function makeEntity(overrides: Partial<GraphEntity> = {}): GraphEntity {
  return {
    id: 'e1',
    name: 'TypeScript',
    type: 'TECHNOLOGY',
    description: 'A typed superset of JavaScript.',
    sourceDocIds: ['doc1'],
    ...overrides,
  };
}

function makeRelationship(overrides: Partial<GraphRelationship> = {}): GraphRelationship {
  return {
    id: 'r1',
    sourceId: 'e1',
    targetId: 'e2',
    type: 'USES',
    description: 'TypeScript uses JavaScript.',
    weight: 7,
    sourceDocIds: ['doc1'],
    ...overrides,
  };
}

describe('GraphStore — entities', () => {
  let store: GraphStore;
  beforeEach(() => {
    store = new GraphStore();
  });

  it('adds an entity and retrieves it', () => {
    const e = makeEntity();
    store.addEntity(e);
    expect(store.entities.get('e1')).toEqual(e);
  });

  it('initialises adjacency entry on addEntity', () => {
    store.addEntity(makeEntity());
    expect(store.adjacency.has('e1')).toBe(true);
  });

  it('merges duplicate entity by id', () => {
    store.addEntity(makeEntity({ description: 'original' }));
    store.addEntity(makeEntity({ description: 'additional info', sourceDocIds: ['doc2'] }));
    const merged = store.entities.get('e1')!;
    expect(merged.description).toContain('original');
    expect(merged.description).toContain('additional info');
    expect(merged.sourceDocIds).toContain('doc1');
    expect(merged.sourceDocIds).toContain('doc2');
  });

  it('mergeEntity throws when entity does not exist', () => {
    expect(() => store.mergeEntity('missing', {})).toThrow('not found');
  });

  it('findEntityByName is case-insensitive', () => {
    store.addEntity(makeEntity({ name: 'TypeScript' }));
    expect(store.findEntityByName('typescript')).toBeDefined();
    expect(store.findEntityByName('TYPESCRIPT')).toBeDefined();
  });

  it('findEntityByName returns undefined for non-existing entity', () => {
    expect(store.findEntityByName('NonExistent')).toBeUndefined();
  });

  it('findEntitiesByName returns partial matches sorted by name length', () => {
    store.addEntity(makeEntity({ id: 'e1', name: 'TypeScript' }));
    store.addEntity(makeEntity({ id: 'e2', name: 'TypeScript Compiler' }));
    const results = store.findEntitiesByName('typescript');
    expect(results).toHaveLength(2);
    expect(results[0].name.length).toBeLessThanOrEqual(results[1].name.length);
  });

  it('findEntitiesByName respects limit', () => {
    for (let i = 0; i < 15; i++) {
      store.addEntity(makeEntity({ id: `e${i}`, name: `TypeScript ${i}` }));
    }
    const results = store.findEntitiesByName('typescript', 5);
    expect(results).toHaveLength(5);
  });

  it('findEntitiesByName returns empty when nothing matches', () => {
    store.addEntity(makeEntity());
    expect(store.findEntitiesByName('Rust')).toHaveLength(0);
  });
});

describe('GraphStore — relationships', () => {
  let store: GraphStore;
  beforeEach(() => {
    store = new GraphStore();
    store.addEntity(makeEntity({ id: 'e1', name: 'A' }));
    store.addEntity(makeEntity({ id: 'e2', name: 'B' }));
  });

  it('adds a relationship and updates adjacency', () => {
    store.addRelationship(makeRelationship());
    expect(store.relationships.has('r1')).toBe(true);
    expect(store.adjacency.get('e1')!.has('e2')).toBe(true);
    expect(store.adjacency.get('e2')!.has('e1')).toBe(true);
  });

  it('creates adjacency entries for previously unknown entity IDs', () => {
    store.addRelationship(makeRelationship({ sourceId: 'e99', targetId: 'e100' }));
    expect(store.adjacency.get('e99')?.has('e100')).toBe(true);
  });

  it('getEntityRelationships returns all rels touching an entity', () => {
    store.addRelationship(makeRelationship({ id: 'r1', sourceId: 'e1', targetId: 'e2' }));
    store.addRelationship(makeRelationship({ id: 'r2', sourceId: 'e2', targetId: 'e1' }));
    const rels = store.getEntityRelationships('e1');
    expect(rels).toHaveLength(2);
  });

  it('getEntityRelationships returns empty for entity with no relationships', () => {
    expect(store.getEntityRelationships('e1')).toHaveLength(0);
  });
});

describe('GraphStore — BFS traversal', () => {
  let store: GraphStore;

  beforeEach(() => {
    store = new GraphStore();
    for (const id of ['e1', 'e2', 'e3', 'e4']) {
      store.addEntity(makeEntity({ id, name: id }));
    }
    store.addRelationship(makeRelationship({ id: 'r1', sourceId: 'e1', targetId: 'e2' }));
    store.addRelationship(makeRelationship({ id: 'r2', sourceId: 'e2', targetId: 'e3' }));
  });

  it('returns only seed entities at depth 0', () => {
    const result = store.bfsNeighbours(['e1'], 0);
    // seed entity plus relationships within visited set
    expect(result.entities.map((e) => e.id)).toContain('e1');
  });

  it('traverses one hop correctly', () => {
    const result = store.bfsNeighbours(['e1'], 1);
    const ids = result.entities.map((e) => e.id);
    expect(ids).toContain('e1');
    expect(ids).toContain('e2');
  });

  it('traverses two hops correctly', () => {
    const result = store.bfsNeighbours(['e1'], 2);
    const ids = result.entities.map((e) => e.id);
    expect(ids).toContain('e3');
  });

  it('returns relationships between visited entities', () => {
    const result = store.bfsNeighbours(['e1'], 2);
    const relIds = result.relationships.map((r) => r.id);
    expect(relIds).toContain('r1');
    expect(relIds).toContain('r2');
  });

  it('stops when frontier is empty', () => {
    const result = store.bfsNeighbours(['e4'], 5);
    // e4 is isolated
    expect(result.entities.map((e) => e.id)).toContain('e4');
    expect(result.relationships).toHaveLength(0);
  });
});

describe('GraphStore — communities', () => {
  let store: GraphStore;
  beforeEach(() => {
    store = new GraphStore();
  });

  it('sets and retrieves communities', () => {
    const communities = [{ id: 'c1', entityIds: ['e1', 'e2'], level: 0 }];
    store.setCommunities(communities);
    expect(store.communities).toHaveLength(1);
  });

  it('getCommunityForEntity finds the right community', () => {
    store.setCommunities([{ id: 'c1', entityIds: ['e1', 'e2'], level: 0 }]);
    expect(store.getCommunityForEntity('e1')?.id).toBe('c1');
    expect(store.getCommunityForEntity('e99')).toBeUndefined();
  });

  it('addCommunityReport stores a report', () => {
    store.addCommunityReport({
      communityId: 'c1',
      title: 'Test',
      summary: 'Summary',
      findings: [],
      rating: 5,
      entityIds: ['e1'],
    });
    expect(store.communityReports.has('c1')).toBe(true);
  });
});

describe('GraphStore — getStats', () => {
  it('returns zeroed stats for an empty graph', () => {
    const store = new GraphStore();
    const stats = store.getStats();
    expect(stats.totalEntities).toBe(0);
    expect(stats.totalRelationships).toBe(0);
    expect(stats.avgRelationshipsPerEntity).toBe(0);
  });

  it('computes entity and relationship type breakdowns', () => {
    const store = new GraphStore();
    store.addEntity(makeEntity({ id: 'e1', type: 'TECHNOLOGY' }));
    store.addEntity(makeEntity({ id: 'e2', type: 'CONCEPT' }));
    store.addRelationship(makeRelationship({ id: 'r1', type: 'USES' }));
    const stats = store.getStats();
    expect(stats.entityTypeBreakdown['TECHNOLOGY']).toBe(1);
    expect(stats.entityTypeBreakdown['CONCEPT']).toBe(1);
    expect(stats.relationshipTypeBreakdown['USES']).toBe(1);
    expect(stats.topEntities).toBeDefined();
  });
});

describe('GraphStore — toJSON & clear', () => {
  it('toJSON serialises the graph', () => {
    const store = new GraphStore();
    store.addEntity(makeEntity());
    const json = store.toJSON();
    expect(json.entities).toHaveLength(1);
    expect(json.stats.totalEntities).toBe(1);
  });

  it('clear empties the store', () => {
    const store = new GraphStore();
    store.addEntity(makeEntity());
    store.clear();
    expect(store.entities.size).toBe(0);
    expect(store.relationships.size).toBe(0);
  });
});
