/**
 * @hazeljs/config-server — Git-backed distributed configuration
 */

export { ConfigServer } from './config-server';
export { ConfigClient } from './config-client';
export { ConfigValue } from './config-value.decorator';
export {
  ConfigServerModule,
  EnableConfigServer,
  getConfigServerMetadata,
} from './config-server.module';
export { ConfigEncryptor } from './encryption';
export { AuditLog } from './audit';
export { GitConfigSource, FilesystemConfigSource } from './git-backend';
export { resolvePropertySources } from './resolver';
export { parseConfigContent, parseProperties } from './parse';
export { deepMerge, getNested } from './merge';

export type {
  GitOptions,
  EncryptionOptions,
  ConfigServerOptions,
  ConfigClientOptions,
  ConfigValueOptions,
  ConfigEnvironment,
  PropertySource,
  AuditEvent,
  AuditAction,
  ConfigSource,
} from './types';
