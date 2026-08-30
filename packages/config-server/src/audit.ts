import type { AuditEvent } from './types';

const DEFAULT_LIMIT = 1000;

export class AuditLog {
  private readonly events: AuditEvent[] = [];
  private readonly limit: number;
  private readonly onAudit?: (event: AuditEvent) => void;

  constructor(options?: { limit?: number; onAudit?: (event: AuditEvent) => void }) {
    this.limit = options?.limit ?? DEFAULT_LIMIT;
    this.onAudit = options?.onAudit;
  }

  record(partial: Omit<AuditEvent, 'at'> & { at?: string }): AuditEvent {
    const event: AuditEvent = {
      at: partial.at ?? new Date().toISOString(),
      action: partial.action,
      application: partial.application,
      profiles: partial.profiles,
      label: partial.label,
      version: partial.version,
      path: partial.path,
      detail: partial.detail,
    };
    this.events.push(event);
    if (this.events.length > this.limit) {
      this.events.splice(0, this.events.length - this.limit);
    }
    this.onAudit?.(event);
    return event;
  }

  list(): AuditEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}
