/**
 * Console audit transport - logs events to stdout as JSON
 */

import type { AuditTransport, AuditEvent } from '../audit.types';

export class ConsoleAuditTransport implements AuditTransport {
  log(event: AuditEvent): void {
    const line = JSON.stringify({
      ...event,
      _type: 'audit',
    });
    process.stdout.write(line + '\n');
  }
}
