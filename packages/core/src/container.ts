import { Type } from './types';
import 'reflect-metadata';
import logger from './logger';

export enum Scope {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
  REQUEST = 'request',
}

export type InjectionToken<T = unknown> = string | symbol | Type<T>;

export interface Provider<T = unknown> {
  token: InjectionToken<T>;
  useClass?: Type<T>;
  useValue?: T;
  useFactory?: (...args: unknown[]) => T | Promise<T>;
  scope?: Scope;
  inject?: InjectionToken[];
}

interface ProviderMetadata {
  instance?: unknown;
  scope: Scope;
  factory?: (requestId?: string) => unknown | Promise<unknown>;
  isResolving?: boolean;
}

export class Container {
  private static instance: Container;
  private providers: Map<InjectionToken, ProviderMetadata> = new Map();
  private requestScopedProviders: Map<string, Map<InjectionToken, unknown>> = new Map();
  // Note: resolutionStack is used per-resolve chain via parameter threading, not shared state

  private constructor() {
    logger.debug('Container initialized');
  }

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Create a new container instance (for testing)
   */
  static createTestInstance(): Container {
    return new Container();
  }

  /**
   * Register a provider with the container
   */
  register<T>(
    token: InjectionToken<T>,
    provider: T | Provider<T>,
    scope: Scope = Scope.SINGLETON
  ): void {
    const tokenName = this.getTokenName(token);
      logger.debug(`Registering provider: ${tokenName} with scope: ${scope}`);

    if (this.isProvider(provider)) {
      this.registerProvider(provider);
    } else {
      this.providers.set(token, {
        instance: provider,
        scope,
      });
    }
  }

  /**
   * Register a provider configuration
   */
  registerProvider<T>(provider: Provider<T>): void {
    const tokenName = this.getTokenName(provider.token);
    logger.debug(`Registering provider configuration: ${tokenName}`);

    const scope = provider.scope || Scope.SINGLETON;
    const metadata: ProviderMetadata = { scope };

    if (provider.useValue !== undefined) {
      metadata.instance = provider.useValue;
    } else if (provider.useFactory) {
      metadata.factory = (requestId?: string): unknown => {
        const deps = (provider.inject || []).map((dep) => this.resolve(dep, requestId));
        return provider.useFactory!(...deps);
      };
    } else if (provider.useClass) {
      metadata.factory = (requestId?: string): unknown =>
        this.createInstance(provider.useClass!, requestId);
    }

    this.providers.set(provider.token, metadata);
  }

  /**
   * Resolve a dependency from the container
   */
  resolve<T>(token: InjectionToken<T>, requestId?: string, resolutionStack?: Set<InjectionToken>): T {
    if (!token) {
      if (logger.isDebugEnabled()) {
        logger.debug('No token provided for resolution');
      }
      return undefined as T;
    }

    if (logger.isDebugEnabled()) {
      const tokenName = this.getTokenName(token);
      logger.debug(`Resolving dependency: ${tokenName}`);
    }

    // Check if provider is registered
    const metadata = this.providers.get(token);

    if (metadata) {
      return this.resolveFromMetadata(token, metadata, requestId, resolutionStack) as T;
    }

    // If token is a class, try to auto-resolve
    if (typeof token === 'function' && token.prototype) {
      return this.autoResolve(token as Type<T>, requestId, resolutionStack);
    }

    if (logger.isDebugEnabled()) {
      logger.warn(`No provider found for token: ${this.getTokenName(token)}`);
    }
    return undefined as T;
  }

  /**
   * Resolve from provider metadata
   */
  private resolveFromMetadata(
    token: InjectionToken,
    metadata: ProviderMetadata,
    requestId?: string,
    resolutionStack?: Set<InjectionToken>
  ): unknown {
    const tokenName = this.getTokenName(token);

    // Use per-chain resolution stack to detect circular deps (thread-safe)
    const stack = resolutionStack || new Set<InjectionToken>();
    if (stack.has(token)) {
      const chain = Array.from(stack).map(t => this.getTokenName(t));
      chain.push(tokenName);
      throw new Error(`Circular dependency detected: ${chain.join(' → ')}`);
    }

    stack.add(token);

    try {
      // Handle different scopes
      switch (metadata.scope) {
        case Scope.SINGLETON:
          if (metadata.instance !== undefined) {
            return metadata.instance;
          }
          if (metadata.isResolving) {
            // Another resolve is already creating this singleton — wait would deadlock in sync, so error
            throw new Error(`Singleton ${tokenName} is already being resolved (possible async race)`);
          }
          if (metadata.factory) {
            metadata.isResolving = true;
            try {
              const result = metadata.factory(requestId);
              metadata.instance = result;
              return metadata.instance;
            } finally {
              metadata.isResolving = false;
            }
          }
          break;

        case Scope.TRANSIENT:
          if (metadata.factory) {
            return metadata.factory(requestId);
          }
          break;

        case Scope.REQUEST:
          if (!requestId) {
            throw new Error(`Request scope requires requestId for: ${tokenName}`);
          }
          return this.resolveRequestScoped(token, metadata, requestId);
      }

      return undefined;
    } finally {
      stack.delete(token);
    }
  }

  /**
   * Resolve request-scoped provider
   */
  private resolveRequestScoped(
    token: InjectionToken,
    metadata: ProviderMetadata,
    requestId: string
  ): unknown {
    let requestProviders = this.requestScopedProviders.get(requestId);

    if (!requestProviders) {
      requestProviders = new Map();
      this.requestScopedProviders.set(requestId, requestProviders);
    }

    if (requestProviders.has(token)) {
      return requestProviders.get(token);
    }

    if (metadata.factory) {
      const instance = metadata.factory(requestId);
      requestProviders.set(token, instance);
      return instance;
    }

    return undefined;
  }

  /**
   * Auto-resolve a class without explicit registration
   */
  private autoResolve<T>(token: Type<T>, requestId?: string, resolutionStack?: Set<InjectionToken>): T {
    if (logger.isDebugEnabled()) {
      logger.debug(`Auto-resolving: ${token.name}`);
    }

    // Check if already registered
    if (this.providers.has(token)) {
      return this.resolve(token, requestId, resolutionStack);
    }

    // Get scope from metadata
    const scope = Reflect.getMetadata('hazel:scope', token) || Scope.SINGLETON;

    // Create factory for the class
    const factory = (reqId?: string): T => this.createInstance(token, reqId, resolutionStack);

    this.providers.set(token, { scope, factory });

    return this.resolve(token, requestId, resolutionStack);
  }

  /**
   * Create instance of a class with dependency injection
   */
  private createInstance<T>(token: Type<T>, requestId?: string, resolutionStack?: Set<InjectionToken>): T {
    // Get constructor parameters
    const params = Reflect.getMetadata('design:paramtypes', token) || [];
    if (logger.isDebugEnabled()) {
      logger.debug(
        `Constructor parameters: ${params.map((p: Type<unknown>) => p?.name || 'undefined').join(', ')}`
      );
    }

    // Get injection tokens if specified
    const injectionTokens = Reflect.getMetadata('hazel:inject', token) || [];

    // Resolve dependencies
    const dependencies = params.map((param: Type<unknown>, index: number) => {
      const injectionToken = injectionTokens[index];
      const tokenToResolve = injectionToken || param;

      if (!tokenToResolve) {
        if (logger.isDebugEnabled()) {
          logger.debug('Undefined parameter type found');
        }
        return undefined;
      }

      if (logger.isDebugEnabled()) {
        logger.debug(`Resolving dependency for: ${this.getTokenName(tokenToResolve)}`);
      }
      return this.resolve(tokenToResolve, requestId, resolutionStack);
    });

    // Create instance with dependencies
    const instance = new token(...dependencies);
    if (logger.isDebugEnabled()) {
        logger.debug(`Created instance of: ${this.getTokenName(token)}`);
    }

    return instance;
  }

  /**
   * Clear request-scoped providers for a specific request
   */
  clearRequestScope(requestId: string): void {
    if (logger.isDebugEnabled()) {
      logger.debug(`Clearing request scope: ${requestId}`);
    }
    this.requestScopedProviders.delete(requestId);
  }

  /**
   * Clear all providers
   */
  clear(): void {
    logger.debug('Clearing container');
    this.providers.clear();
    this.requestScopedProviders.clear();
  }

  /**
   * Check if a token is registered
   */
  has(token: InjectionToken): boolean {
    return this.providers.has(token);
  }

  /**
   * Get all registered tokens
   */
  getTokens(): InjectionToken[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Helper to get token name for logging
   */
  private getTokenName(token: InjectionToken): string {
    if (typeof token === 'string') return token;
    if (typeof token === 'symbol') return token.toString();
    if (typeof token === 'function') return token.name;
    return 'unknown';
  }

  /**
   * Type guard to check if value is a Provider
   */
  private isProvider<T>(value: unknown): value is Provider<T> {
    return typeof value === 'object' && value !== null && 'token' in value;
  }
}
