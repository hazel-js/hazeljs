/**
 * Optional Redis approval provider from env / URL.
 */

import {
  createRedisApprovalProvider,
  type RedisApprovalCommands,
  type RedisApprovalProviderOptions,
} from '../approval/redis';
import type { ApprovalProvider } from '../approval/provider';

export interface RedisApprovalFromEnvOptions extends RedisApprovalProviderOptions {
  /** Override URL (default: GATEKEEPER_REDIS_URL || REDIS_URL). */
  url?: string;
  /** Called when redis package is missing but a URL is set. */
  onMissingRedisPackage?: (url: string) => void;
}

/**
 * Create a Redis approval provider when a URL is available and `redis` is installed.
 * Returns undefined otherwise (caller should fall back to HumanTask / memory).
 */
export function tryCreateRedisApprovalProvider(
  options: RedisApprovalFromEnvOptions = {}
): ApprovalProvider | undefined {
  const url =
    options.url?.trim() ||
    process.env.GATEKEEPER_REDIS_URL?.trim() ||
    process.env.REDIS_URL?.trim();
  if (!url) return undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('redis') as {
      createClient: (opts: { url: string }) => RedisApprovalCommands & {
        connect?: () => Promise<unknown>;
      };
    };
    const client = createClient({ url });
    void client.connect?.();
    return createRedisApprovalProvider(client, options);
  } catch {
    options.onMissingRedisPackage?.(url);
    return undefined;
  }
}
