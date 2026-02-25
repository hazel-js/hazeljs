/**
 * Gateway Module
 * Integrates @hazeljs/gateway with @hazeljs/config for config-driven routing.
 *
 * Usage:
 *   1. Define a gateway config loader (gateway.config.ts) that reads env vars
 *   2. Register it with ConfigModule.forRoot({ load: [gatewayConfig] })
 *   3. Use GatewayModule.forRoot() to create the gateway from config
 *
 * Example:
 *   GatewayModule.forRoot({ configKey: 'gateway' })
 *   // reads ConfigService.get('gateway') -> GatewayFullConfig
 */

import { GatewayFullConfig } from './types';

export interface GatewayModuleOptions {
  /**
   * Key in ConfigService to read gateway config from.
   * The value at this key should conform to GatewayFullConfig.
   * Default: 'gateway'
   */
  configKey?: string;

  /**
   * Provide gateway config directly (for programmatic use
   * without @hazeljs/config dependency).
   * If both `config` and `configKey` are set, `config` takes precedence.
   */
  config?: GatewayFullConfig;
}

/**
 * GatewayModule follows the same forRoot() pattern as ConfigModule.
 *
 * It stores the options statically so the gateway can be created later
 * when the app boots and ConfigService is available.
 */
export class GatewayModule {
  private static options: GatewayModuleOptions = {};

  /**
   * Register the gateway module with configuration options.
   *
   * @example
   * // Config-driven (reads from ConfigService):
   * GatewayModule.forRoot({ configKey: 'gateway' })
   *
   * // Direct config (no ConfigService needed):
   * GatewayModule.forRoot({ config: { discovery: {...}, routes: [...] } })
   */
  static forRoot(options: GatewayModuleOptions = {}): { module: typeof GatewayModule } {
    GatewayModule.options = {
      configKey: 'gateway',
      ...options,
    };
    return { module: GatewayModule };
  }

  /**
   * Get the registered options.
   */
  static getOptions(): GatewayModuleOptions {
    return GatewayModule.options;
  }

  /**
   * Resolve the gateway configuration.
   *
   * If `config` was provided directly, returns it.
   * Otherwise, reads from the provided ConfigService using the configKey.
   *
   * @param configService - Optional ConfigService instance. Required if
   *   no direct `config` was provided in forRoot().
   */
  static resolveConfig(configService?: {
    get: <T>(key: string) => T | undefined;
  }): GatewayFullConfig {
    const opts = GatewayModule.options;

    // Direct config takes precedence
    if (opts.config) {
      return opts.config;
    }

    // Otherwise read from ConfigService
    if (!configService) {
      throw new Error(
        'GatewayModule: No config provided and no ConfigService available. ' +
          'Either pass config directly via GatewayModule.forRoot({ config: {...} }) ' +
          'or provide a ConfigService instance.'
      );
    }

    const key = opts.configKey || 'gateway';
    const config = configService.get<GatewayFullConfig>(key);

    if (!config) {
      throw new Error(
        `GatewayModule: No configuration found at key "${key}". ` +
          `Make sure your config loader returns a "${key}" key with routes.`
      );
    }

    if (!config.routes || !Array.isArray(config.routes)) {
      throw new Error(
        `GatewayModule: Configuration at key "${key}" is missing a "routes" array. ` +
          'Each route needs at least { path, serviceName }.'
      );
    }

    return config;
  }
}
