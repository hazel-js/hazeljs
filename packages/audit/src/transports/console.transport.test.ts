/// <reference types="jest" />
import { ConsoleAuditTransport } from './console.transport';
import type { AuditEvent } from '../audit.types';

describe('ConsoleAuditTransport', () => {
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('should write JSON line with _type audit', () => {
    const transport = new ConsoleAuditTransport();
    const event: AuditEvent = {
      action: 'user.login',
      timestamp: '2025-01-01T00:00:00.000Z',
      result: 'success',
    };
    transport.log(event);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const line = writeSpy.mock.calls[0][0];
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line.trim());
    expect(parsed._type).toBe('audit');
    expect(parsed.action).toBe('user.login');
    expect(parsed.timestamp).toBe(event.timestamp);
    expect(parsed.result).toBe('success');
  });

  it('should include all event fields in output', () => {
    const transport = new ConsoleAuditTransport();
    const event: AuditEvent = {
      action: 'order.create',
      actor: { id: 1, username: 'alice' },
      resource: 'Order',
      resourceId: 'ord-123',
      result: 'success',
      timestamp: '2025-01-01T00:00:00.000Z',
      metadata: { amount: 99 },
    };
    transport.log(event);
    const parsed = JSON.parse(writeSpy.mock.calls[0][0].trim());
    expect(parsed.actor).toEqual({ id: 1, username: 'alice' });
    expect(parsed.resource).toBe('Order');
    expect(parsed.resourceId).toBe('ord-123');
    expect(parsed.metadata).toEqual({ amount: 99 });
  });
});
