/**
 * HTTP provider for external KYC/verification APIs
 */

import { resolveTemplate } from '../../utils/template';
import type { SecretResolver } from './secrets';
import type { HttpOperation } from './templates';

/** HTTP provider interface */
export interface HttpProvider {
  name: string;
  call(
    operation: HttpOperation,
    state: Record<string, unknown>,
    resolveSecret?: SecretResolver,
  ): Promise<unknown>;
}
