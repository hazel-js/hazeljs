/**
 * Inspector configuration defaults and merging
 */

import type { InspectorModuleOptions } from '../contracts/types';

export const DEFAULT_HIDDEN_METADATA_KEYS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'connectionString',
  'connection_string',
];

export function mergeInspectorConfig(
  options?: InspectorModuleOptions
): Required<InspectorModuleOptions> {
  return {
    enableInspector: options?.enableInspector ?? true,
    inspectorBasePath: options?.inspectorBasePath ?? '/__hazel',
    exposeUi: options?.exposeUi ?? true,
    exposeJson: options?.exposeJson ?? true,
    developmentOnly: options?.developmentOnly ?? true,
    requireAuth: options?.requireAuth ?? false,
    enabledInspectors: options?.enabledInspectors ?? [],
    hiddenMetadataKeys: options?.hiddenMetadataKeys ?? DEFAULT_HIDDEN_METADATA_KEYS,
    maxSnapshotCacheAgeMs: options?.maxSnapshotCacheAgeMs ?? 5000,
  };
}

export function shouldExposeInspector(config: Required<InspectorModuleOptions>): boolean {
  if (!config.enableInspector) return false;
  if (config.developmentOnly && process.env.NODE_ENV === 'production') {
    return false;
  }
  return true;
}
