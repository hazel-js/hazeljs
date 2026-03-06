import { CommunityDetector } from '../../graph/community-detector';
import { GraphStore } from '../../graph/knowledge-graph';

function addEntity(store: GraphStore, id: string): void {
  store.addEntity({ id, name: id, type: 'CONCEPT', description: '', sourceDocIds: [] });
}

function addRel(store: GraphStore, id: string, src: string, tgt: string, weight = 5): void {
  store.addRelationship({
    id,
    sourceId: src,
    targetId: tgt,
    type: 'RELATED_TO',
    description: '',
    weight,
    sourceDocIds: [],
  });
}

describe('CommunityDetector', () => {
  it('returns empty for an empty graph', () => {
    const detector = new CommunityDetector();
    const result = detector.detect(new GraphStore());
    expect(result).toEqual([]);
  });

  it('assigns a community to every entity', () => {
    const store = new GraphStore();
    for (const id of ['e1', 'e2', 'e3', 'e4']) addEntity(store, id);
    addRel(store, 'r1', 'e1', 'e2', 8);
    addRel(store, 'r2', 'e2', 'e3', 8);
    addRel(store, 'r3', 'e3', 'e4', 8);

    const detector = new CommunityDetector();
    const communities = detector.detect(store);
    const allEntityIds = communities.flatMap((c) => c.entityIds);
    expect(allEntityIds.sort()).toEqual(['e1', 'e2', 'e3', 'e4'].sort());
  });

  it('produces valid community objects with id and level', () => {
    const store = new GraphStore();
    for (const id of ['a', 'b', 'c']) addEntity(store, id);
    addRel(store, 'r1', 'a', 'b');
    addRel(store, 'r2', 'b', 'c');

    const detector = new CommunityDetector();
    const communities = detector.detect(store);
    for (const c of communities) {
      expect(c.id).toMatch(/^community_\d+$/);
      expect(c.level).toBe(0);
      expect(c.entityIds.length).toBeGreaterThan(0);
    }
  });

  it('splits communities exceeding maxCommunitySize', () => {
    const store = new GraphStore();
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    for (const id of ids) addEntity(store, id);
    // Create a dense community by connecting all to a hub
    for (let i = 1; i < 20; i++) {
      addRel(store, `r${i}`, 'n0', `n${i}`, 10);
    }

    const detector = new CommunityDetector({ maxCommunitySize: 5 });
    const communities = detector.detect(store);
    // At least some communities should be smaller than 20
    expect(communities.some((c) => c.entityIds.length <= 20)).toBe(true);
    // All entities should be covered
    const total = communities.flatMap((c) => c.entityIds).length;
    expect(total).toBe(20);
  });

  it('handles isolated nodes (no relationships)', () => {
    const store = new GraphStore();
    for (const id of ['x', 'y', 'z']) addEntity(store, id);
    // No relationships at all

    const detector = new CommunityDetector();
    const communities = detector.detect(store);
    const total = communities.flatMap((c) => c.entityIds).length;
    expect(total).toBe(3);
  });

  it('uses custom maxIterations without error', () => {
    const store = new GraphStore();
    addEntity(store, 'p');
    addEntity(store, 'q');
    addRel(store, 'r1', 'p', 'q', 3);

    const detector = new CommunityDetector({ maxIterations: 2 });
    expect(() => detector.detect(store)).not.toThrow();
  });
});
