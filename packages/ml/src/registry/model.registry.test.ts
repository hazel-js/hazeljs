import { ModelRegistry } from './model.registry';
import type { RegisteredModel } from './model.registry';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  it('registers and retrieves model by name and version', () => {
    const model: RegisteredModel = {
      metadata: { name: 'sentiment', version: '1.0.0', framework: 'tensorflow' },
      instance: {},
      trainMethod: 'train',
      predictMethod: 'predict',
    };
    registry.register(model);
    const retrieved = registry.get('sentiment', '1.0.0');
    expect(retrieved).toBe(model);
  });

  it('returns latest version when version not specified', () => {
    const v1: RegisteredModel = {
      metadata: { name: 'model', version: '1.0.0', framework: 'tensorflow' },
      instance: {},
    };
    const v2: RegisteredModel = {
      metadata: { name: 'model', version: '2.0.0', framework: 'tensorflow' },
      instance: {},
    };
    registry.register(v1);
    registry.register(v2);
    expect(registry.get('model')).toBe(v2);
    expect(registry.get('model', '1.0.0')).toBe(v1);
  });

  it('returns undefined for unknown model', () => {
    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.get('unknown', '1.0.0')).toBeUndefined();
  });

  it('lists all registered models', () => {
    registry.register({
      metadata: { name: 'a', version: '1', framework: 'tensorflow' },
      instance: {},
    });
    registry.register({
      metadata: { name: 'b', version: '1', framework: 'onnx' },
      instance: {},
    });
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.name)).toContain('a');
    expect(list.map((m) => m.name)).toContain('b');
  });

  it('getVersions returns empty array for unknown model', () => {
    expect(registry.getVersions('unknown')).toEqual([]);
  });

  it('getVersions returns version history', () => {
    registry.register({
      metadata: { name: 'model', version: '1.0.0', framework: 'tensorflow' },
      instance: {},
    });
    registry.register({
      metadata: { name: 'model', version: '2.0.0', framework: 'tensorflow' },
      instance: {},
    });
    const versions = registry.getVersions('model');
    expect(versions).toHaveLength(2);
    expect(versions.map((v) => v.version)).toEqual(['1.0.0', '2.0.0']);
  });

  it('unregister removes model', () => {
    registry.register({
      metadata: { name: 'model', version: '1.0.0', framework: 'tensorflow' },
      instance: {},
    });
    expect(registry.get('model', '1.0.0')).toBeDefined();
    const deleted = registry.unregister('model', '1.0.0');
    expect(deleted).toBe(true);
    expect(registry.get('model', '1.0.0')).toBeUndefined();
    expect(registry.unregister('model', '1.0.0')).toBe(false);
  });

  it('unregister updates versions list when deleting', () => {
    registry.register({
      metadata: { name: 'm', version: '1.0.0', framework: 'tensorflow' },
      instance: {},
    });
    registry.register({
      metadata: { name: 'm', version: '2.0.0', framework: 'tensorflow' },
      instance: {},
    });
    registry.unregister('m', '1.0.0');
    const versions = registry.getVersions('m');
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('2.0.0');
  });

  it('persists and loads artifacts', () => {
    const dir = `/tmp/hazeljs-ml-registry-${Date.now()}`;
    registry.configurePersistence(dir);
    registry.register({
      metadata: { name: 'art', version: '1.0.0', framework: 'custom' },
      instance: {},
    });
    const path = registry.saveArtifact('art', '1.0.0', { weights: [1, 2] }, { accuracy: 0.9 });
    expect(path).toContain('art');
    expect(registry.getVersions('art')[0].path).toBe(path);
    const loaded = registry.loadArtifact<{ weights: number[] }>('art', '1.0.0');
    expect(loaded.artifact.weights).toEqual([1, 2]);
    expect(loaded.metrics?.accuracy).toBe(0.9);

    // save without prior register still works
    const path2 = registry.saveArtifact('orphan', '0.1.0', { ok: true });
    expect(registry.loadArtifact('orphan', '0.1.0').artifact).toEqual({ ok: true });
    expect(path2).toContain('orphan');
  });

  it('throws when persistence not configured or artifact missing', () => {
    expect(() => registry.saveArtifact('x', '1', {})).toThrow('not configured');
    registry.configurePersistence(`/tmp/hazeljs-ml-registry-empty-${Date.now()}`);
    expect(() => registry.loadArtifact('missing', '1.0.0')).toThrow('Artifact not found');
  });
});
