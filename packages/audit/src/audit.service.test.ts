/// <reference types="jest" />
import { logger } from '@hazeljs/core';
import { AuditService } from './audit.service';
import type { AuditEvent, AuditTransport } from './audit.types';

describe('AuditService', () => {
  let captured: AuditEvent[];
  let mockTransport: AuditTransport;

  beforeEach(() => {
    captured = [];
    mockTransport = {
      log: (event: AuditEvent) => {
        captured.push(event);
      },
    };
    AuditService.configure({});
  });

  it('should use provided transports', () => {
    const service = new AuditService({ transports: [mockTransport] });
    service.log({ action: 'user.login' });
    expect(captured).toHaveLength(1);
    expect(captured[0].action).toBe('user.login');
  });

  it('should use custom redactKeys', () => {
    const service = new AuditService({
      transports: [mockTransport],
      redactKeys: ['customSecret'],
    });
    service.log({ action: 'test', metadata: { customSecret: 'x', other: 'y' } });
    expect(captured[0].metadata).toEqual({ customSecret: '[REDACTED]', other: 'y' });
  });

  it('configure merges options into new instances', () => {
    AuditService.configure({ transports: [mockTransport] });
    const service = new AuditService();
    service.log({ action: 'configured' });
    expect(captured[0].action).toBe('configured');
  });

  it('log adds timestamp when not provided', () => {
    const service = new AuditService({ transports: [mockTransport] });
    service.log({ action: 'test' });
    expect(captured[0].timestamp).toBeDefined();
  });

  it('log uses provided timestamp', () => {
    const service = new AuditService({ transports: [mockTransport] });
    service.log({ action: 'test', timestamp: '2025-01-01T00:00:00.000Z' });
    expect(captured[0].timestamp).toBe('2025-01-01T00:00:00.000Z');
  });

  it('log calls all transports', () => {
    const second: AuditEvent[] = [];
    const service = new AuditService({
      transports: [
        mockTransport,
        {
          log: (e) => {
            second.push(e);
          },
        },
      ],
    });
    service.log({ action: 'multi' });
    expect(captured).toHaveLength(1);
    expect(second[0].action).toBe('multi');
  });

  it('log redacts default sensitive keys', () => {
    const service = new AuditService({ transports: [mockTransport] });
    service.log({ action: 'test', metadata: { password: 'secret', safe: 'ok' } });
    expect(captured[0].metadata).toEqual({ password: '[REDACTED]', safe: 'ok' });
  });

  it('log catches transport errors', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation();
    const service = new AuditService({
      transports: [
        {
          log: () => {
            throw new Error('fail');
          },
        },
      ],
    });
    service.log({ action: 'test' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('log handles async transport rejection', async () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation();
    const service = new AuditService({
      transports: [{ log: () => Promise.reject(new Error('async fail')) }],
    });
    service.log({ action: 'test' });
    await new Promise((r) => setImmediate(r));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('addTransport adds a transport at runtime', () => {
    const extra: AuditEvent[] = [];
    const service = new AuditService({ transports: [mockTransport] });
    service.addTransport({
      log: (e) => {
        extra.push(e);
      },
    });
    service.log({ action: 'runtime' });
    expect(captured).toHaveLength(1);
    expect(extra).toHaveLength(1);
    expect(extra[0].action).toBe('runtime');
  });

  it('actorFromContext returns undefined when no user', () => {
    const service = new AuditService({ transports: [mockTransport] });
    const ctx = { method: 'GET', url: '/', headers: {}, params: {}, query: {}, body: undefined };
    expect(service.actorFromContext(ctx)).toBeUndefined();
  });

  it('actorFromContext returns actor from context.user', () => {
    const service = new AuditService({ transports: [mockTransport] });
    const ctx = {
      method: 'GET',
      url: '/',
      headers: {},
      params: {},
      query: {},
      body: undefined,
      user: { id: 1, username: 'alice', role: 'admin' },
    };
    expect(service.actorFromContext(ctx)).toEqual({ id: 1, username: 'alice', role: 'admin' });
  });

  it('eventFromContext builds event with action', () => {
    const service = new AuditService({ transports: [mockTransport] });
    const ctx = {
      method: 'POST',
      url: '/orders',
      headers: {},
      params: {},
      query: {},
      body: undefined,
    };
    const event = service.eventFromContext(ctx, 'success', 'order.create');
    expect(event.action).toBe('order.create');
    expect(event.result).toBe('success');
    expect(event.method).toBe('POST');
    expect(event.path).toBe('/orders');
  });

  it('eventFromContext uses default action', () => {
    const service = new AuditService({ transports: [mockTransport] });
    const ctx = {
      method: 'GET',
      url: '/users',
      headers: {},
      params: {},
      query: {},
      body: undefined,
    };
    const event = service.eventFromContext(ctx);
    expect(event.action).toBe('http.get');
  });

  it('eventFromContext includes actor when user present', () => {
    const service = new AuditService({ transports: [mockTransport] });
    const ctx = {
      method: 'POST',
      url: '/',
      headers: {},
      params: {},
      query: {},
      body: undefined,
      user: { id: 'u1', username: 'bob', role: 'user' },
    };
    const event = service.eventFromContext(ctx, 'success');
    expect(event.actor).toEqual({ id: 'u1', username: 'bob', role: 'user' });
  });
});
