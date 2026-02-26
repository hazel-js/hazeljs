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
});
