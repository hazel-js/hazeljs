import { HazelModule } from '@hazeljs/core';
import { ConfigService } from './config.service';

@HazelModule({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {
  /**
   * Register ConfigModule with options
   */
  static forRoot(options?: ConfigModuleOptions): typeof ConfigModule {
    if (options) {
      ConfigService.setOptions(options);
    }
    return ConfigModule;
  }
}

export interface ConfigModuleOptions {
  /**
   * Path to .env file
   */
  envFilePath?: string | string[];

  /**
   * Whether to ignore .env file
   */
  ignoreEnvFile?: boolean;

  /**
   * Whether to ignore environment variables
   */
  ignoreEnvVars?: boolean;

  /**
   * Validation schema for configuration
   */
  validationSchema?: ValidationSchema;

  /**
   * Validation options
   */
  validationOptions?: {
    allowUnknown?: boolean;
    abortEarly?: boolean;
  };

  /**
   * Whether configuration is global
   */
  isGlobal?: boolean;

  /**
   * Custom configuration loader
   */
  load?: Array<() => Record<string, unknown>>;
}

export interface ValidationSchema {
  validate(config: Record<string, unknown>): {
    error?: Error;
    value: Record<string, unknown>;
  };
}
