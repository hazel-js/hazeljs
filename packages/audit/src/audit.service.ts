/**
 * AuditService - Record audit events and send to configured transports
 */

import { Injectable, logger } from '@hazeljs/core';
import type { RequestContext } from '@hazeljs/core';
import type { AuditEvent, AuditTransport, AuditActor, AuditModuleOptions } from './audit.types';
import { ConsoleAuditTransport } from './transports/console.transport';

@Injectable()
export class AuditService {
  private static staticOptions: AuditModuleOptions = {};
  private transports: AuditTransport[] = [];
  private redactKeys: Set<string> = new Set();

  constructor(options?: AuditModuleOptions) {
    const opts = options ?? { ...AuditService.staticOptions };
    this.redactKeys = new Set(
      (opts.redactKeys ?? ['password', 'token', 'secret', 'authorization']).map((k) =>
        k.toLowerCase()
      )
    );
    if (opts.transports && opts.transports.length > 0) {
      this.transports = opts.transports;
    } else {
      this.transports = [new ConsoleAuditTransport()];
    }
  }

  static configure(options: AuditModuleOptions): void {
    AuditService.staticOptions = { ...AuditService.staticOptions, ...options };
  }

  /**
   * Add a transport at runtime (e.g. Kafka after producer is available).
   */
  addTransport(transport: AuditTransport): void {
    this.transports.push(transport);
  }

  /**
   * Record an audit event. Events are sent to all configured transports.
   */
  log(event: Omit<AuditEvent, 'timestamp'> & { timestamp?: string }): void {
    const full: AuditEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    const sanitized = this.sanitize(full);
    for (const transport of this.transports) {
      try {
        const result = transport.log(sanitized);
        if (result instanceof Promise) {
          result.catch((err) => {
            logger.error('[AuditService] transport error:', err);
          });
        }
      } catch (err) {
        logger.error('[AuditService] transport error:', err);
      }
    }
  }

  /**
   * Create an actor from RequestContext (e.g. authenticated user).
   */
  actorFromContext(context: RequestContext): AuditActor | undefined {
    if (!context.user) return undefined;
    const { id, username, role, ...rest } = context.user;
    return { id, username, role, ...rest };
  }

  /**
   * Build a minimal audit event from an HTTP request context (for use by AuditInterceptor).
   */
  eventFromContext(
    context: RequestContext,
    result: 'success' | 'failure' | 'denied' = 'success',
    action?: string
  ): AuditEvent {
    const actor = this.actorFromContext(context);
    return {
      action: action ?? `http.${context.method?.toLowerCase()}`,
      actor,
      result,
      timestamp: new Date().toISOString(),
      method: context.method,
      path: context.url,
      metadata: context.url ? { path: context.url, method: context.method } : undefined,
    };
  }

  private sanitize(event: AuditEvent): AuditEvent {
    if (!event.metadata || this.redactKeys.size === 0) return event;
    const metadata = { ...event.metadata };
    for (const key of Object.keys(metadata)) {
      if (this.redactKeys.has(key.toLowerCase())) {
        metadata[key] = '[REDACTED]';
      }
    }
    return { ...event, metadata };
  }
}
