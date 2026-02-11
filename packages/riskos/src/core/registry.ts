/**
 * Service registry for optional integrations (compliance, analytics)
 * Integrations are activated when their sinks/handlers exist.
 */

import type { EventBus } from '../bus/eventBus';
import type { AuditSink } from '../audit/sink';

/** Registry of optional service integrations */
export interface RiskOSRegistry {
  bus: EventBus;
  auditSink?: AuditSink;
}
