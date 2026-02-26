/**
 * @hazeljs/contracts - HazelContext for request-scoped execution
 */

import type { HazelEvent } from './events';

/** Actor information for audit and authorization */
export interface HazelActor {
  userId?: string;
  role?: string;
  ip?: string;
  clientId?: string;
}

/** Extended emit function for metrics helpers */
export interface MetricsEmitter {
  count(name: string, value?: number, tags?: Record<string, string | number | boolean>): void;
  timing(name: string, ms: number, tags?: Record<string, string | number | boolean>): void;
}

/** Request context with emit capability for cross-module event bus */
export interface HazelContext {
  requestId: string;
  tenantId?: string;
  actor?: HazelActor;
  purpose?: string;
  tags: Record<string, unknown>;
  /** Emit event to the event bus */
  emit(event: HazelEvent): void;
  /** Helper emitters for common metrics */
  metrics: MetricsEmitter;
}
