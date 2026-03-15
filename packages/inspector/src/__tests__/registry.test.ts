import { HazelInspectorRegistry } from '../registry/registry';
import type { InspectorContext } from '../contracts/types';

describe('HazelInspectorRegistry', () => {
  const mockContext: InspectorContext = {
    moduleType: class AppModule {},
    container: { getTokens: () => [] } as unknown as InspectorContext['container'],
    router: {} as InspectorContext['router'],
  };

  it('should register and run plugins', async () => {
    const registry = new HazelInspectorRegistry();
    registry.register({
      name: 'test',
      supports: () => true,
      inspect: async () => [
        {
          id: '1',
          kind: 'route',
          packageName: '@test',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
      ],
    });

    const results = await registry.runAll(mockContext);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('should skip plugins that do not support context', async () => {
    const registry = new HazelInspectorRegistry();
    registry.register({
      name: 'unsupported',
      supports: () => false,
      inspect: async () => [
        {
          id: 'x',
          kind: 'route',
          packageName: '@x',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
      ],
    });

    const results = await registry.runAll(mockContext);
    expect(results).toHaveLength(0);
  });

  it('should deduplicate by id', async () => {
    const registry = new HazelInspectorRegistry();
    registry.register({
      name: 'a',
      supports: () => true,
      inspect: async () => [
        {
          id: 'same',
          kind: 'route',
          packageName: '@a',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
      ],
    });
    registry.register({
      name: 'b',
      supports: () => true,
      inspect: async () => [
        {
          id: 'same',
          kind: 'route',
          packageName: '@b',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
      ],
    });

    const results = await registry.runAll(mockContext);
    expect(results).toHaveLength(1);
  });

  it('should return plugins via getPlugins', () => {
    const registry = new HazelInspectorRegistry();
    const plugin = { name: 'p1', supports: () => true, inspect: async () => [] };
    registry.register(plugin);
    expect(registry.getPlugins()).toHaveLength(1);
    expect(registry.getPlugins()[0].name).toBe('p1');
  });

  it('should not register duplicate plugin by name', () => {
    const registry = new HazelInspectorRegistry();
    registry.register({ name: 'dup', supports: () => true, inspect: async () => [] });
    registry.register({ name: 'dup', supports: () => true, inspect: async () => [] });
    expect(registry.getPlugins()).toHaveLength(1);
  });

  it('should handle plugin returning non-array', async () => {
    const registry = new HazelInspectorRegistry();
    registry.register({
      name: 'non-array',
      supports: () => true,
      inspect: async () => null as any,
    });
    const results = await registry.runAll(mockContext);
    expect(results).toHaveLength(0);
  });

  it('should skip and log when plugin throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const registry = new HazelInspectorRegistry();
    registry.register({
      name: 'throws',
      supports: () => true,
      inspect: async () => {
        throw new Error('plugin error');
      },
    });
    const results = await registry.runAll(mockContext);
    expect(results).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
