import { mergeInspectorConfig, shouldExposeInspector } from '../config/inspector.config';

describe('mergeInspectorConfig', () => {
  it('returns defaults when options is undefined', () => {
    const config = mergeInspectorConfig(undefined);
    expect(config.enableInspector).toBe(true);
    expect(config.inspectorBasePath).toBe('/__hazel');
    expect(config.exposeUi).toBe(true);
    expect(config.exposeJson).toBe(true);
    expect(config.developmentOnly).toBe(true);
    expect(config.requireAuth).toBe(false);
    expect(config.enabledInspectors).toEqual([]);
    expect(config.hiddenMetadataKeys).toContain('password');
    expect(config.hiddenMetadataKeys).toContain('secret');
    expect(config.maxSnapshotCacheAgeMs).toBe(5000);
  });

  it('merges provided options over defaults', () => {
    const config = mergeInspectorConfig({
      inspectorBasePath: '/custom',
      developmentOnly: false,
      maxSnapshotCacheAgeMs: 10000,
    });
    expect(config.inspectorBasePath).toBe('/custom');
    expect(config.developmentOnly).toBe(false);
    expect(config.maxSnapshotCacheAgeMs).toBe(10000);
    expect(config.enableInspector).toBe(true);
  });

  it('uses custom hiddenMetadataKeys when provided', () => {
    const config = mergeInspectorConfig({
      hiddenMetadataKeys: ['customKey'],
    });
    expect(config.hiddenMetadataKeys).toEqual(['customKey']);
  });
});

describe('shouldExposeInspector', () => {
  it('returns false when enableInspector is false', () => {
    const config = mergeInspectorConfig({ enableInspector: false });
    expect(shouldExposeInspector(config)).toBe(false);
  });

  it('returns false when developmentOnly and NODE_ENV is production', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const config = mergeInspectorConfig({ developmentOnly: true });
    expect(shouldExposeInspector(config)).toBe(false);
    process.env.NODE_ENV = orig;
  });

  it('returns true when developmentOnly and NODE_ENV is not production', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const config = mergeInspectorConfig({ developmentOnly: true });
    expect(shouldExposeInspector(config)).toBe(true);
    process.env.NODE_ENV = orig;
  });

  it('returns true when developmentOnly is false regardless of NODE_ENV', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const config = mergeInspectorConfig({ developmentOnly: false, enableInspector: true });
    expect(shouldExposeInspector(config)).toBe(true);
    process.env.NODE_ENV = orig;
  });
});
