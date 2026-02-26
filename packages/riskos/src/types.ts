/**
 * RiskOS shared types
 */

import type { HazelContext } from '@hazeljs/contracts';

/** Options for createContext */
export interface CreateContextOptions {
  tenantId?: string;
  actor?: { userId?: string; role?: string; ip?: string };
  purpose?: string;
  tags?: Record<string, unknown>;
}

/** Options for run() action execution */
export interface RunOptions {
  actionName: string;
  ctxBase: HazelContext | CreateContextOptions;
  fn: (ctx: HazelContext) => Promise<unknown> | unknown;
}

/** Plugin-like object for HazelJS .use() */
export interface RiskOSPlugin {
  name: string;
  install(app: unknown, options?: Record<string, unknown>): void | Promise<void>;
}
