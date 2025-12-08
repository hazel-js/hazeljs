import 'reflect-metadata';

/**
 * Version types
 */
export enum VersioningType {
  URI = 'uri',
  HEADER = 'header',
  MEDIA_TYPE = 'media-type',
  CUSTOM = 'custom',
}

/**
 * Versioning options
 */
export interface VersioningOptions {
  type: VersioningType;
  header?: string;
  key?: string;
  extractor?: (request: unknown) => string | undefined;
}

/**
 * Version decorator for controllers and routes
 */
export function Version(version: string | string[]): MethodDecorator & ClassDecorator {
  const decorator = (
    target: object | (new (...args: unknown[]) => object),
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): PropertyDescriptor | void => {
    const versions = Array.isArray(version) ? version : [version];

    if (propertyKey && descriptor) {
      // Method decorator
      Reflect.defineMetadata('hazel:version', versions, target, propertyKey);
      return descriptor;
    } else {
      // Class decorator
      Reflect.defineMetadata('hazel:version', versions, target);
    }
  };

  return decorator as MethodDecorator & ClassDecorator;
}

/**
 * Get version metadata from a class or method
 */
export function getVersionMetadata(
  target: object | (new (...args: unknown[]) => object),
  propertyKey?: string | symbol
): string[] | undefined {
  if (propertyKey) {
    return Reflect.getMetadata('hazel:version', target, propertyKey);
  }
  return Reflect.getMetadata('hazel:version', target);
}

/**
 * Check if a version matches the requested version
 */
export function matchVersion(
  routeVersions: string[] | undefined,
  requestedVersion: string | undefined,
  _options?: VersioningOptions
): boolean {
  // If no version specified on route, it matches all versions
  if (!routeVersions || routeVersions.length === 0) {
    return true;
  }

  // If no version requested, don't match versioned routes
  if (!requestedVersion) {
    return false;
  }

  // Check if requested version is in route versions
  return routeVersions.includes(requestedVersion);
}

/**
 * Extract version from request based on versioning type
 */
export function extractVersion(request: unknown, options: VersioningOptions): string | undefined {
  const req = request as { url?: string; headers?: Record<string, string> };
  switch (options.type) {
    case VersioningType.URI: {
      // Extract from URL path (e.g., /v1/users)
      const match = req.url?.match(/\/v(\d+)\//);
      return match ? match[1] : undefined;
    }

    case VersioningType.HEADER: {
      // Extract from custom header
      const headerName = options.header || 'X-API-Version';
      return req.headers?.[headerName.toLowerCase()];
    }

    case VersioningType.MEDIA_TYPE: {
      // Extract from Accept header (e.g., application/vnd.api.v1+json)
      const accept = req.headers?.['accept'];
      const mediaMatch = accept?.match(/\.v(\d+)\+/);
      return mediaMatch ? mediaMatch[1] : undefined;
    }

    case VersioningType.CUSTOM:
      // Use custom extractor
      return options.extractor?.(req);

    default:
      return undefined;
  }
}
