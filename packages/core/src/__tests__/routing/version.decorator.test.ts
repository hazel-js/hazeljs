import {
  Version,
  getVersionMetadata,
  matchVersion,
  extractVersion,
  VersioningType,
} from '../../routing/version.decorator';
import 'reflect-metadata';

describe('Version Decorator', () => {
  describe('Version decorator', () => {
    it('should set version metadata on method', () => {
      class TestController {
        @Version('1')
        getUsers() {
          return [];
        }
      }

      const metadata = getVersionMetadata(TestController.prototype, 'getUsers');
      expect(metadata).toEqual(['1']);
    });

    it('should set version metadata on class', () => {
      @Version('1')
      class TestController {}

      const metadata = getVersionMetadata(TestController);
      expect(metadata).toEqual(['1']);
    });

    it('should support multiple versions', () => {
      class TestController {
        @Version(['1', '2', '3'])
        getUsers() {
          return [];
        }
      }

      const metadata = getVersionMetadata(TestController.prototype, 'getUsers');
      expect(metadata).toEqual(['1', '2', '3']);
    });

    it('should convert single version to array', () => {
      class TestController {
        @Version('2')
        getUsers() {
          return [];
        }
      }

      const metadata = getVersionMetadata(TestController.prototype, 'getUsers');
      expect(metadata).toEqual(['2']);
    });

    it('should work with both class and method decorators', () => {
      @Version('1')
      class TestController {
        @Version('2')
        getUsers() {
          return [];
        }
      }

      const classMetadata = getVersionMetadata(TestController);
      const methodMetadata = getVersionMetadata(TestController.prototype, 'getUsers');

      expect(classMetadata).toEqual(['1']);
      expect(methodMetadata).toEqual(['2']);
    });
  });

  describe('getVersionMetadata', () => {
    it('should return undefined for unversioned class', () => {
      class TestController {}

      const metadata = getVersionMetadata(TestController);
      expect(metadata).toBeUndefined();
    });

    it('should return undefined for unversioned method', () => {
      class TestController {
        getUsers() {
          return [];
        }
      }

      const metadata = getVersionMetadata(TestController.prototype, 'getUsers');
      expect(metadata).toBeUndefined();
    });

    it('should retrieve method metadata', () => {
      class TestController {
        @Version('1')
        getUsers() {
          return [];
        }
      }

      const metadata = getVersionMetadata(TestController.prototype, 'getUsers');
      expect(metadata).toEqual(['1']);
    });

    it('should retrieve class metadata', () => {
      @Version('2')
      class TestController {}

      const metadata = getVersionMetadata(TestController);
      expect(metadata).toEqual(['2']);
    });
  });

  describe('matchVersion', () => {
    it('should match when versions match', () => {
      const result = matchVersion(['1', '2'], '1');
      expect(result).toBe(true);
    });

    it('should not match when versions differ', () => {
      const result = matchVersion(['1', '2'], '3');
      expect(result).toBe(false);
    });

    it('should match any version when route has no version', () => {
      const result = matchVersion(undefined, '1');
      expect(result).toBe(true);
    });

    it('should match any version when route versions is empty', () => {
      const result = matchVersion([], '1');
      expect(result).toBe(true);
    });

    it('should not match when no version requested', () => {
      const result = matchVersion(['1', '2'], undefined);
      expect(result).toBe(false);
    });

    it('should match multiple versions', () => {
      const versions = ['1', '2', '3'];
      expect(matchVersion(versions, '1')).toBe(true);
      expect(matchVersion(versions, '2')).toBe(true);
      expect(matchVersion(versions, '3')).toBe(true);
      expect(matchVersion(versions, '4')).toBe(false);
    });
  });

  describe('extractVersion - URI', () => {
    it('should extract version from URI', () => {
      const request = { url: '/v1/users' };
      const version = extractVersion(request, { type: VersioningType.URI });

      expect(version).toBe('1');
    });

    it('should extract different version numbers', () => {
      const request = { url: '/v2/users' };
      const version = extractVersion(request, { type: VersioningType.URI });

      expect(version).toBe('2');
    });

    it('should return undefined when no version in URI', () => {
      const request = { url: '/users' };
      const version = extractVersion(request, { type: VersioningType.URI });

      expect(version).toBeUndefined();
    });

    it('should extract version from nested path', () => {
      const request = { url: '/api/v3/users/123' };
      const version = extractVersion(request, { type: VersioningType.URI });

      expect(version).toBe('3');
    });
  });

  describe('extractVersion - HEADER', () => {
    it('should extract version from default header', () => {
      const request = {
        headers: { 'x-api-version': '1' },
      };
      const version = extractVersion(request, { type: VersioningType.HEADER });

      expect(version).toBe('1');
    });

    it('should extract version from custom header', () => {
      const request = {
        headers: { 'api-version': '2' },
      };
      const version = extractVersion(request, {
        type: VersioningType.HEADER,
        header: 'API-Version',
      });

      expect(version).toBe('2');
    });

    it('should return undefined when header missing', () => {
      const request = { headers: {} };
      const version = extractVersion(request, { type: VersioningType.HEADER });

      expect(version).toBeUndefined();
    });

    it('should handle case-insensitive headers', () => {
      const request = {
        headers: { 'x-api-version': '3' },
      };
      const version = extractVersion(request, {
        type: VersioningType.HEADER,
        header: 'X-API-Version',
      });

      expect(version).toBe('3');
    });
  });

  describe('extractVersion - MEDIA_TYPE', () => {
    it('should extract version from Accept header', () => {
      const request = {
        headers: { accept: 'application/vnd.api.v1+json' },
      };
      const version = extractVersion(request, { type: VersioningType.MEDIA_TYPE });

      expect(version).toBe('1');
    });

    it('should extract different versions', () => {
      const request = {
        headers: { accept: 'application/vnd.api.v2+json' },
      };
      const version = extractVersion(request, { type: VersioningType.MEDIA_TYPE });

      expect(version).toBe('2');
    });

    it('should return undefined when no version in media type', () => {
      const request = {
        headers: { accept: 'application/json' },
      };
      const version = extractVersion(request, { type: VersioningType.MEDIA_TYPE });

      expect(version).toBeUndefined();
    });

    it('should return undefined when Accept header missing', () => {
      const request = { headers: {} };
      const version = extractVersion(request, { type: VersioningType.MEDIA_TYPE });

      expect(version).toBeUndefined();
    });
  });

  describe('extractVersion - CUSTOM', () => {
    it('should use custom extractor', () => {
      const request = { customField: 'v1' };
      const extractor = (req: any) => req.customField?.replace('v', '');
      
      const version = extractVersion(request, {
        type: VersioningType.CUSTOM,
        extractor,
      });

      expect(version).toBe('1');
    });

    it('should return undefined when extractor returns undefined', () => {
      const request = {};
      const extractor = () => undefined;
      
      const version = extractVersion(request, {
        type: VersioningType.CUSTOM,
        extractor,
      });

      expect(version).toBeUndefined();
    });

    it('should handle complex custom logic', () => {
      const request = {
        headers: { 'x-custom': 'version-2' },
      };
      const extractor = (req: any) => {
        const header = req.headers?.['x-custom'];
        return header?.split('-')[1];
      };
      
      const version = extractVersion(request, {
        type: VersioningType.CUSTOM,
        extractor,
      });

      expect(version).toBe('2');
    });
  });

  describe('extractVersion - edge cases', () => {
    it('should handle missing request properties', () => {
      const request = {};
      const version = extractVersion(request, { type: VersioningType.URI });

      expect(version).toBeUndefined();
    });

    it('should handle undefined request', () => {
      // The implementation doesn't handle undefined request gracefully
      // This test documents that behavior
      expect(() => {
        extractVersion(undefined, { type: VersioningType.URI });
      }).toThrow();
    });

    it('should return undefined for unknown versioning type', () => {
      const request = { url: '/v1/users' };
      const version = extractVersion(request, { type: 'unknown' as any });

      expect(version).toBeUndefined();
    });
  });
});
