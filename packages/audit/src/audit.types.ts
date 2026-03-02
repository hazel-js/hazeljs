/**
 * Audit event and module options
 */

export interface AuditActor {
  id: string | number;
  username?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuditEvent {
  /** Action identifier (e.g. 'user.login', 'order.create') */
  action: string;
  /** Who performed the action (optional if not in request context) */
  actor?: AuditActor;
  /** Resource affected (e.g. 'User', 'Order', entity id) */
  resource?: string;
  /** Resource identifier (e.g. entity id) */
  resourceId?: string | number;
  /** Outcome: success, failure, denied */
  result?: 'success' | 'failure' | 'denied';
  /** ISO timestamp */
  timestamp: string;
  /** Request or correlation id for tracing */
  requestId?: string;
  /** HTTP method when from HTTP request */
  method?: string;
  /** Path/URL when from HTTP request */
  path?: string;
  /** Additional structured data (no PII by default) */
  metadata?: Record<string, unknown>;
}

export interface AuditTransport {
  /** Send an audit event to the transport (e.g. console, DB, external service) */
  log(event: AuditEvent): void | Promise<void>;
}

export interface AuditModuleOptions {
  /** Transports to use (default: console) */
  transports?: AuditTransport[];
  /** Include request context (method, path) in auto-audit events */
  includeRequestContext?: boolean;
  /** Redact sensitive keys from metadata */
  redactKeys?: string[];
}
