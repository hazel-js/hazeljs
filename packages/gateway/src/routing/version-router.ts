/**
 * Version Router
 * Routes requests to specific service versions based on:
 *   - Header (X-API-Version)
 *   - URI prefix (/v2/api/...)
 *   - Query parameter (?version=v2)
 *   - Weighted random (percentage-based)
 */

import { VersionRouteConfig, VersionRouteEntry, ProxyRequest } from '../types';

export interface VersionResolution {
  /** The resolved version to route to */
  version: string;
  /** How the version was resolved */
  resolvedBy: 'header' | 'uri' | 'query' | 'weight' | 'default';
}

export class VersionRouter {
  private config: VersionRouteConfig;

  constructor(config: VersionRouteConfig) {
    this.config = {
      strategy: config.strategy ?? 'header',
      header: config.header ?? 'X-API-Version',
      queryParam: config.queryParam ?? 'version',
      ...config,
    };
  }

  /**
   * Resolve the target version for an incoming request
   */
  resolve(request: ProxyRequest): VersionResolution {
    // 1. Try explicit version from header
    if (this.config.strategy === 'header' || !this.config.strategy) {
      const headerVersion = this.resolveFromHeader(request);
      if (headerVersion) return headerVersion;
    }

    // 2. Try explicit version from URI
    if (this.config.strategy === 'uri') {
      const uriVersion = this.resolveFromUri(request);
      if (uriVersion) return uriVersion;
    }

    // 3. Try explicit version from query
    if (this.config.strategy === 'query') {
      const queryVersion = this.resolveFromQuery(request);
      if (queryVersion) return queryVersion;
    }

    // 4. Fall back to weighted selection
    const weightedVersion = this.resolveByWeight();
    if (weightedVersion) return weightedVersion;

    // 5. Fall back to default version
    if (this.config.defaultVersion) {
      return {
        version: this.config.defaultVersion,
        resolvedBy: 'default',
      };
    }

    // 6. Use the first defined version
    const firstVersion = Object.keys(this.config.routes)[0];
    return {
      version: firstVersion,
      resolvedBy: 'default',
    };
  }

  /**
   * Get the version configuration for a specific version
   */
  getVersionEntry(version: string): VersionRouteEntry | undefined {
    return this.config.routes[version];
  }

  /**
   * Get all configured versions
   */
  getVersions(): string[] {
    return Object.keys(this.config.routes);
  }

  // ─── Resolution Strategies ───

  private resolveFromHeader(request: ProxyRequest): VersionResolution | null {
    const headerName = this.config.header!;
    const headerValue = request.headers[headerName] || request.headers[headerName.toLowerCase()];

    if (headerValue && typeof headerValue === 'string') {
      const version = headerValue.trim();
      const entry = this.config.routes[version];
      if (entry && (entry.weight > 0 || entry.allowExplicit)) {
        return { version, resolvedBy: 'header' };
      }
    }

    return null;
  }

  private resolveFromUri(request: ProxyRequest): VersionResolution | null {
    // Extract version from URI like /v2/api/users -> v2
    const match = request.path.match(/^\/(v\d+)(\/.*)?$/);
    if (match) {
      const version = match[1];
      const entry = this.config.routes[version];
      if (entry && (entry.weight > 0 || entry.allowExplicit)) {
        return { version, resolvedBy: 'uri' };
      }
    }
    return null;
  }

  private resolveFromQuery(request: ProxyRequest): VersionResolution | null {
    const paramName = this.config.queryParam!;
    const version = request.query?.[paramName];

    if (version) {
      const entry = this.config.routes[version];
      if (entry && (entry.weight > 0 || entry.allowExplicit)) {
        return { version, resolvedBy: 'query' };
      }
    }

    return null;
  }

  private resolveByWeight(): VersionResolution | null {
    // Collect versions with weight > 0
    const weighted: Array<{ version: string; weight: number }> = [];
    let totalWeight = 0;

    for (const [version, entry] of Object.entries(this.config.routes)) {
      if (entry.weight > 0) {
        weighted.push({ version, weight: entry.weight });
        totalWeight += entry.weight;
      }
    }

    if (weighted.length === 0 || totalWeight === 0) return null;

    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const item of weighted) {
      random -= item.weight;
      if (random <= 0) {
        return { version: item.version, resolvedBy: 'weight' };
      }
    }

    // Fallback (shouldn't reach here due to float precision)
    return {
      version: weighted[weighted.length - 1].version,
      resolvedBy: 'weight',
    };
  }
}
