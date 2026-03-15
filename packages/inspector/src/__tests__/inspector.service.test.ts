import { HazelInspectorService } from '../service/inspector.service';
import { HazelInspectorRegistry } from '../registry/registry';
import { mergeInspectorConfig } from '../config/inspector.config';
import type { InspectorContext } from '../contracts/types';

const mockContext: InspectorContext = {
  moduleType: class AppModule {},
  container: { getTokens: () => [] } as unknown as InspectorContext['container'],
  router: {} as InspectorContext['router'],
};

function createService(
  registry?: HazelInspectorRegistry,
  config?: { maxSnapshotCacheAgeMs?: number }
): HazelInspectorService {
  const reg = registry ?? new HazelInspectorRegistry();
  return new HazelInspectorService(
    reg,
    mergeInspectorConfig({
      maxSnapshotCacheAgeMs: config?.maxSnapshotCacheAgeMs ?? 5000,
    })
  );
}

describe('HazelInspectorService', () => {
  describe('collectSnapshot', () => {
    it('returns snapshot with entries from registry', async () => {
      const registry = new HazelInspectorRegistry();
      registry.register({
        name: 'test',
        supports: () => true,
        inspect: async () => [
          {
            id: 'r1',
            kind: 'route',
            packageName: '@test',
            httpMethod: 'GET',
            fullPath: '/',
            controllerPath: '/',
            routePath: '/',
          } as any,
          { id: 'm1', kind: 'module', packageName: '@test', moduleName: 'AppModule' } as any,
        ],
      });
      const service = createService(registry);
      const snapshot = await service.collectSnapshot(mockContext);
      expect(snapshot.entries).toHaveLength(2);
      expect(snapshot.summary?.route).toBe(1);
      expect(snapshot.summary?.module).toBe(1);
      expect(snapshot.collectedAt).toBeDefined();
    });

    it('caches snapshot within maxSnapshotCacheAgeMs', async () => {
      const registry = new HazelInspectorRegistry();
      let callCount = 0;
      registry.register({
        name: 'test',
        supports: () => true,
        inspect: async () => {
          callCount++;
          return [
            {
              id: '1',
              kind: 'route',
              packageName: '@t',
              httpMethod: 'GET',
              fullPath: '/',
              controllerPath: '/',
              routePath: '/',
            } as any,
          ];
        },
      });
      const service = createService(registry, { maxSnapshotCacheAgeMs: 5000 });
      const s1 = await service.collectSnapshot(mockContext);
      const s2 = await service.collectSnapshot(mockContext);
      expect(s1).toBe(s2);
      expect(callCount).toBe(1);
    });

    it('refreshes when refresh is called', async () => {
      const registry = new HazelInspectorRegistry();
      let callCount = 0;
      registry.register({
        name: 'test',
        supports: () => true,
        inspect: async () => {
          callCount++;
          return [
            {
              id: '1',
              kind: 'route',
              packageName: '@t',
              httpMethod: 'GET',
              fullPath: '/',
              controllerPath: '/',
              routePath: '/',
            } as any,
          ];
        },
      });
      const service = createService(registry);
      await service.collectSnapshot(mockContext);
      await service.refresh(mockContext);
      expect(callCount).toBe(2);
    });
  });

  describe('getters', () => {
    it('getRoutes filters route entries', async () => {
      const service = createService();
      const entries = [
        {
          id: 'r1',
          kind: 'route',
          packageName: '@t',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
        { id: 'm1', kind: 'module', packageName: '@t', moduleName: 'M' } as any,
      ];
      expect(service.getRoutes(entries)).toHaveLength(1);
      expect(service.getRoutes(entries)[0].kind).toBe('route');
    });

    it('getModules filters module entries', async () => {
      const service = createService();
      const entries = [
        { id: 'm1', kind: 'module', packageName: '@t', moduleName: 'M' } as any,
        {
          id: 'r1',
          kind: 'route',
          packageName: '@t',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
      ];
      expect(service.getModules(entries)).toHaveLength(1);
      expect(service.getModules(entries)[0].moduleName).toBe('M');
    });

    it('getByKind filters by kind', async () => {
      const service = createService();
      const entries = [
        {
          id: 'r1',
          kind: 'route',
          packageName: '@t',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
        {
          id: 'r2',
          kind: 'route',
          packageName: '@t',
          httpMethod: 'POST',
          fullPath: '/x',
          controllerPath: '/',
          routePath: '/x',
        } as any,
      ];
      expect(service.getByKind(entries, 'route')).toHaveLength(2);
    });
  });

  describe('collectSnapshot with non-array from registry', () => {
    it('handles registry returning non-array', async () => {
      const registry = new HazelInspectorRegistry();
      jest.spyOn(registry, 'runAll').mockResolvedValue(undefined as any);
      const service = createService(registry);
      const snapshot = await service.collectSnapshot(mockContext);
      expect(snapshot.entries).toEqual([]);
      expect(snapshot.summary).toEqual({});
    });
  });

  describe('getGroupedSnapshot', () => {
    it('returns grouped snapshot with all kinds', async () => {
      const service = createService();
      const entries = [
        {
          id: 'r1',
          kind: 'route',
          packageName: '@t',
          httpMethod: 'GET',
          fullPath: '/',
          controllerPath: '/',
          routePath: '/',
        } as any,
        { id: 'j1', kind: 'cron', packageName: '@t', cronTime: '* * * * *', name: 'job' } as any,
        { id: 'x1', kind: 'custom', packageName: '@t' } as any,
      ];
      const grouped = service.getGroupedSnapshot(entries);
      expect(grouped.routes).toHaveLength(1);
      expect(grouped.jobs).toHaveLength(1);
      expect(grouped.other).toHaveLength(1);
    });
  });
});
