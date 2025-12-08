import { Type } from '../types';
import { Container, Provider, InjectionToken } from '../container';
import logger from '../logger';

/**
 * Testing module builder
 */
export class TestingModuleBuilder {
  private controllers: Type<unknown>[] = [];
  private providers: Array<Type<unknown> | Provider> = [];
  private imports: Type<unknown>[] = [];

  /**
   * Create a testing module
   */
  static createTestingModule(metadata: TestingModuleMetadata): TestingModuleBuilder {
    const builder = new TestingModuleBuilder();

    if (metadata.controllers) {
      builder.controllers = metadata.controllers;
    }

    if (metadata.providers) {
      builder.providers = metadata.providers;
    }

    if (metadata.imports) {
      builder.imports = metadata.imports;
    }

    return builder;
  }

  /**
   * Override a provider for testing
   */
  overrideProvider<T>(token: InjectionToken<T>): OverrideByBuilder<T> {
    return new OverrideByBuilder(this, token);
  }

  /**
   * Compile the testing module
   */
  async compile(): Promise<TestingModule> {
    logger.info('Compiling testing module');

    const container = Container.createTestInstance();

    // Register providers
    for (const provider of this.providers) {
      if (typeof provider === 'function') {
        const instance = container.resolve(provider);
        container.register(provider, instance);
      } else {
        container.registerProvider(provider);
      }
    }

    // Register controllers
    for (const controller of this.controllers) {
      const instance = container.resolve(controller);
      container.register(controller, instance);
    }

    return new TestingModule(container);
  }

  /**
   * Internal method to replace a provider
   */
  replaceProvider<T>(token: InjectionToken<T>, provider: Provider<T>): void {
    const index = this.providers.findIndex((p) => {
      if (typeof p === 'function') {
        return p === token;
      }
      return p.token === token;
    });

    if (index !== -1) {
      this.providers[index] = provider;
    } else {
      this.providers.push(provider);
    }
  }
}

/**
 * Override builder for fluent API
 */
export class OverrideByBuilder<T> {
  constructor(
    private readonly builder: TestingModuleBuilder,
    private readonly token: InjectionToken<T>
  ) {}

  /**
   * Override with a value
   */
  useValue(value: T): TestingModuleBuilder {
    this.builder.replaceProvider(this.token, {
      token: this.token,
      useValue: value,
    });
    return this.builder;
  }

  /**
   * Override with a class
   */
  useClass(useClass: Type<T>): TestingModuleBuilder {
    this.builder.replaceProvider(this.token, {
      token: this.token,
      useClass,
    });
    return this.builder;
  }

  /**
   * Override with a factory
   */
  useFactory(factory: (...args: unknown[]) => T, inject?: InjectionToken[]): TestingModuleBuilder {
    this.builder.replaceProvider(this.token, {
      token: this.token,
      useFactory: factory,
      inject,
    });
    return this.builder;
  }
}

/**
 * Compiled testing module
 */
export class TestingModule {
  constructor(private readonly container: Container) {}

  /**
   * Get an instance from the container
   */
  get<T>(token: InjectionToken<T>): T {
    return this.container.resolve(token);
  }

  /**
   * Select a specific module context
   */
  select(_module: Type<unknown>): TestingModule {
    // For now, return the same module
    // In a full implementation, this would handle module isolation
    return this;
  }

  /**
   * Close the testing module and cleanup
   */
  async close(): Promise<void> {
    this.container.clear();
    logger.info('Testing module closed');
  }
}

/**
 * Testing module metadata
 */
export interface TestingModuleMetadata {
  controllers?: Type<unknown>[];
  providers?: Array<Type<unknown> | Provider>;
  imports?: Type<unknown>[];
}

/**
 * Test utility class
 */
export class Test {
  /**
   * Create a testing module builder
   */
  static createTestingModule(metadata: TestingModuleMetadata): TestingModuleBuilder {
    return TestingModuleBuilder.createTestingModule(metadata);
  }
}
