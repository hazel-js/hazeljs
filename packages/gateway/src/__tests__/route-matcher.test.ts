import { matchRoute, sortRoutesBySpecificity } from '../routing/route-matcher';

describe('matchRoute', () => {
  describe('exact matches', () => {
    it('should match exact paths', () => {
      const result = matchRoute('/api/users', '/api/users');
      expect(result.matched).toBe(true);
    });

    it('should not match different paths', () => {
      const result = matchRoute('/api/users', '/api/orders');
      expect(result.matched).toBe(false);
    });

    it('should normalize paths', () => {
      const result = matchRoute('api/users', '/api/users');
      expect(result.matched).toBe(true);
    });
  });

  describe('parameter matches', () => {
    it('should match path parameters', () => {
      const result = matchRoute('/api/users/:id', '/api/users/123');
      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ id: '123' });
    });

    it('should match multiple parameters', () => {
      const result = matchRoute('/api/:service/:id', '/api/users/456');
      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ service: 'users', id: '456' });
    });
  });

  describe('wildcard matches', () => {
    it('should match single-segment wildcard', () => {
      const result = matchRoute('/api/*/users', '/api/v2/users');
      expect(result.matched).toBe(true);
    });

    it('should not match multi-segment with single wildcard', () => {
      const result = matchRoute('/api/*/users', '/api/v2/v3/users');
      expect(result.matched).toBe(false);
    });
  });

  describe('catch-all (**)', () => {
    it('should match everything under prefix', () => {
      expect(matchRoute('/api/users/**', '/api/users').matched).toBe(true);
      expect(matchRoute('/api/users/**', '/api/users/123').matched).toBe(true);
      expect(matchRoute('/api/users/**', '/api/users/123/orders').matched).toBe(true);
    });

    it('should not match different prefix', () => {
      expect(matchRoute('/api/users/**', '/api/orders').matched).toBe(false);
    });

    it('should capture remaining path', () => {
      const result = matchRoute('/api/users/**', '/api/users/123/orders');
      expect(result.remainingPath).toBe('/123/orders');
    });
  });
});

describe('sortRoutesBySpecificity', () => {
  it('should sort most specific first', () => {
    const routes = ['/api/**', '/api/users/:id', '/api/users/me', '/api/users/*'];

    const sorted = sortRoutesBySpecificity(routes);

    // /api/users/me (most specific - all literal segments)
    expect(sorted[0]).toBe('/api/users/me');
    // /api/users/:id (param is less specific than literal)
    // /api/users/* (wildcard is less specific than param)
    // /api/** (catch-all is least specific)
    expect(sorted[sorted.length - 1]).toBe('/api/**');
  });
});
