import { VersionRouter } from '../routing/version-router';
import { ProxyRequest } from '../types';

function makeRequest(overrides: Partial<ProxyRequest> = {}): ProxyRequest {
  return {
    method: 'GET',
    path: '/api/test',
    headers: {},
    ...overrides,
  };
}

describe('VersionRouter', () => {
  describe('header-based routing', () => {
    it('should resolve version from header', () => {
      const router = new VersionRouter({
        header: 'X-API-Version',
        routes: {
          v1: { weight: 80 },
          v2: { weight: 20 },
        },
      });

      const result = router.resolve(
        makeRequest({ headers: { 'X-API-Version': 'v2' } })
      );
      expect(result.version).toBe('v2');
      expect(result.resolvedBy).toBe('header');
    });

    it('should resolve explicitly allowed version even with 0 weight', () => {
      const router = new VersionRouter({
        header: 'X-API-Version',
        routes: {
          v1: { weight: 100 },
          v2: { weight: 0, allowExplicit: true },
        },
      });

      const result = router.resolve(
        makeRequest({ headers: { 'X-API-Version': 'v2' } })
      );
      expect(result.version).toBe('v2');
      expect(result.resolvedBy).toBe('header');
    });

    it('should not resolve version with 0 weight and no allowExplicit', () => {
      const router = new VersionRouter({
        header: 'X-API-Version',
        routes: {
          v1: { weight: 100 },
          v2: { weight: 0 },
        },
      });

      // Header says v2 but it's not explicitly allowed
      const result = router.resolve(
        makeRequest({ headers: { 'X-API-Version': 'v2' } })
      );
      expect(result.version).toBe('v1');
      expect(result.resolvedBy).toBe('weight');
    });
  });

  describe('weighted routing', () => {
    it('should fall back to weighted routing when no explicit version', () => {
      const router = new VersionRouter({
        routes: {
          v1: { weight: 100 },
          v2: { weight: 0 },
        },
      });

      const result = router.resolve(makeRequest());
      expect(result.version).toBe('v1');
      expect(result.resolvedBy).toBe('weight');
    });

    it('should distribute based on weights', () => {
      const router = new VersionRouter({
        routes: {
          v1: { weight: 50 },
          v2: { weight: 50 },
        },
      });

      const counts: Record<string, number> = { v1: 0, v2: 0 };
      for (let i = 0; i < 1000; i++) {
        const result = router.resolve(makeRequest());
        counts[result.version]++;
      }

      // With 50/50 weight over 1000 runs, each should be roughly 500
      expect(counts['v1']).toBeGreaterThan(350);
      expect(counts['v2']).toBeGreaterThan(350);
    });
  });

  describe('default version', () => {
    it('should use defaultVersion when no other resolution works', () => {
      const router = new VersionRouter({
        defaultVersion: 'v1',
        routes: {
          v1: { weight: 0 },
          v2: { weight: 0 },
        },
      });

      const result = router.resolve(makeRequest());
      expect(result.version).toBe('v1');
      expect(result.resolvedBy).toBe('default');
    });
  });

  describe('URI-based routing', () => {
    it('should resolve version from URI path', () => {
      const router = new VersionRouter({
        strategy: 'uri',
        routes: {
          v1: { weight: 100 },
          v2: { weight: 0, allowExplicit: true },
        },
      });

      const result = router.resolve(makeRequest({ path: '/v2/api/test' }));
      expect(result.version).toBe('v2');
      expect(result.resolvedBy).toBe('uri');
    });
  });

  describe('query-based routing', () => {
    it('should resolve version from query parameter', () => {
      const router = new VersionRouter({
        strategy: 'query',
        queryParam: 'version',
        routes: {
          v1: { weight: 100 },
          v2: { weight: 0, allowExplicit: true },
        },
      });

      const result = router.resolve(
        makeRequest({ query: { version: 'v2' } })
      );
      expect(result.version).toBe('v2');
      expect(result.resolvedBy).toBe('query');
    });
  });

  describe('getVersions', () => {
    it('should return all configured versions', () => {
      const router = new VersionRouter({
        routes: {
          v1: { weight: 50 },
          v2: { weight: 50 },
          v3: { weight: 0 },
        },
      });

      expect(router.getVersions()).toEqual(['v1', 'v2', 'v3']);
    });
  });
});
