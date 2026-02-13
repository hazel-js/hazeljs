/**
 * HTTP provider for external KYC/verification APIs
 */

import type { SecretResolver } from './secrets';
import type { HttpOperation } from './templates';

/** HTTP provider interface */
export interface HttpProvider {
  name: string;
  call(
    operation: HttpOperation,
    state: Record<string, unknown>,
    resolveSecret?: SecretResolver
  ): Promise<unknown>;
}
