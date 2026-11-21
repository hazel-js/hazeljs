/**
 * @hazeljs/config - Configuration module for HazelJS
 */

export {
  ConfigModule,
  type ConfigModuleOptions,
  type ValidationSchema as ConfigValidationSchema,
} from './config.module';
export { ConfigService } from './config.service';
export { loadEnvFiles, type LoadEnvFilesOptions, type LoadEnvFilesResult } from './load-env-files';
