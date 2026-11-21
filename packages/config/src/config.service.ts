import { Service } from '@hazeljs/core';
import { ConfigModuleOptions, ValidationSchema } from './config.module';
import logger from '@hazeljs/core';
import { loadEnvFiles } from './load-env-files';

@Service()
export class ConfigService {
  private static options: ConfigModuleOptions = {};
  private config: Record<string, unknown> = {};
  private isLoaded = false;

  constructor() {
    this.load();
  }

  /**
   * Set module options (called by ConfigModule.forRoot)
   */
  static setOptions(options: ConfigModuleOptions): void {
    ConfigService.options = options;
  }

  /**
   * Load configuration
   */
  private load(): void {
    if (this.isLoaded) return;

    const options = ConfigService.options;

    // Load from .env files
    if (!options.ignoreEnvFile) {
      this.loadEnvFiles(options.envFilePath);
    }

    // Load from environment variables
    if (!options.ignoreEnvVars) {
      this.config = { ...this.config, ...process.env };
    }

    // Load custom configurations
    if (options.load) {
      options.load.forEach((loader) => {
        const customConfig = loader();
        this.config = { ...this.config, ...customConfig };
      });
    }

    // Validate configuration
    if (options.validationSchema) {
      this.validate(options.validationSchema, options.validationOptions);
    }

    this.isLoaded = true;
    logger.info('Configuration loaded successfully');
  }

  /**
   * Load environment files via shared loadEnvFiles helper.
   */
  private loadEnvFiles(envFilePath?: string | string[]): void {
    const { loaded, parsed } = loadEnvFiles({
      cwd: process.cwd(),
      envFilePath: envFilePath ?? '.env',
    });
    for (const fullPath of loaded) {
      logger.debug(`Loading environment file: ${fullPath}`);
    }
    if (Object.keys(parsed).length > 0) {
      this.config = { ...this.config, ...parsed };
    }
  }

  /**
   * Validate configuration against schema
   */
  private validate(
    schema: ValidationSchema,
    options?: { allowUnknown?: boolean; abortEarly?: boolean }
  ): void {
    const result = schema.validate(this.config);

    if (result.error) {
      const message = `Configuration validation error: ${result.error.message}`;
      logger.error(message);

      if (!options?.abortEarly) {
        throw new Error(message);
      }
    }

    this.config = result.value;
  }

  /**
   * Get a configuration value
   */
  get<T = unknown>(key: string): T | undefined;
  get<T = unknown>(key: string, defaultValue: T): T;
  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.getNestedValue(key);
    return value !== undefined ? (value as T) : defaultValue;
  }

  /**
   * Get nested value using dot notation
   */
  private getNestedValue(key: string): unknown {
    const keys = key.split('.');
    let value: unknown = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Set a configuration value
   */
  set(key: string, value: unknown): void {
    this.config[key] = value;
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return this.getNestedValue(key) !== undefined;
  }

  /**
   * Get configuration as a specific type
   */
  getOrThrow<T = unknown>(key: string): T {
    const value = this.get<T>(key);

    if (value === undefined) {
      throw new Error(`Configuration key "${key}" is required but not found`);
    }

    return value;
  }
}
