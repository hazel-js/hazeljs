import logger from '../logger';

/**
 * Route pattern matcher with support for:
 * - Named parameters (:id)
 * - Optional parameters (:id?)
 * - Wildcard routes (*)
 * - Regex patterns
 */
export class RouteMatcher {
  private pattern!: RegExp;
  private paramNames: string[] = [];
  private isWildcard = false;

  constructor(private readonly path: string) {
    this.compile();
  }

  /**
   * Compile the route path into a regex pattern
   */
  private compile(): void {
    // Check for wildcard
    if (this.path.includes('*')) {
      this.isWildcard = true;
    }

    let pattern = this.path;

    // Escape special regex characters except : and *
    pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Handle optional parameters (:id?)
    pattern = pattern.replace(/:(\w+)\?/g, (_, paramName) => {
      this.paramNames.push(paramName);
      return '(?:/([^/]+))?';
    });

    // Handle required parameters (:id)
    pattern = pattern.replace(/:(\w+)/g, (_, paramName) => {
      this.paramNames.push(paramName);
      return '([^/]+)';
    });

    // Handle wildcards (*)
    pattern = pattern.replace(/\*/g, '(.*)');

    // Ensure exact match with optional trailing slash
    this.pattern = new RegExp(`^${pattern}/?$`);

    logger.debug(`Compiled route pattern: ${this.path} -> ${this.pattern}`);
  }

  /**
   * Match a URL path against this route
   */
  match(path: string): RouteMatch | null {
    const match = this.pattern.exec(path);

    if (!match) {
      return null;
    }

    const params: Record<string, string> = {};

    // Extract parameters
    for (let i = 0; i < this.paramNames.length; i++) {
      const value = match[i + 1];
      if (value !== undefined) {
        params[this.paramNames[i]] = decodeURIComponent(value);
      }
    }

    // Handle wildcard
    if (this.isWildcard && match[match.length - 1]) {
      params['*'] = match[match.length - 1];
    }

    return {
      params,
      path: this.path,
    };
  }

  /**
   * Get the route path
   */
  getPath(): string {
    return this.path;
  }

  /**
   * Check if route has parameters
   */
  hasParams(): boolean {
    return this.paramNames.length > 0;
  }

  /**
   * Get parameter names
   */
  getParamNames(): string[] {
    return [...this.paramNames];
  }
}

export interface RouteMatch {
  params: Record<string, string>;
  path: string;
}
