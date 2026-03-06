/// <reference types="jest" />
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from '../audit.service';
import type { RequestContext } from '@hazeljs/core';

describe('AuditInterceptor', () => {
  let auditService: AuditService;
  let captured: unknown[];

  beforeEach(() => {
    captured = [];
    auditService = new AuditService({
      transports: [
        {
          log: (e) => {
            captured.push(e);
          },
        },
      ],
    });
  });

  const emptyContext: RequestContext = {
    method: 'GET',
    url: '/test',
    headers: {},
    params: {},
    query: {},
    body: undefined,
  };

  it('should call next and log success event', async () => {
    const interceptor = new AuditInterceptor(auditService);
    const next = jest.fn().mockResolvedValue('ok');
    const result = await interceptor.intercept(emptyContext, next);
    expect(result).toBe('ok');
    expect(next).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
    expect((captured[0] as { result: string }).result).toBe('success');
    expect((captured[0] as { action: string }).action).toBe('http.get');
  });

  it('should log failure and rethrow when next throws', async () => {
    const interceptor = new AuditInterceptor(auditService);
    const err = new Error('handler failed');
    const next = jest.fn().mockRejectedValue(err);
    await expect(interceptor.intercept(emptyContext, next)).rejects.toThrow('handler failed');
    expect(next).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
    expect((captured[0] as { result: string }).result).toBe('failure');
  });

  it('should use http.request when method is missing', async () => {
    const interceptor = new AuditInterceptor(auditService);
    const ctx = { ...emptyContext, method: '' };
    const next = jest.fn().mockResolvedValue(undefined);
    await interceptor.intercept(ctx, next);
    expect((captured[0] as { action: string }).action).toBe('http.request');
  });
});
