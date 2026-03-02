/**
 * AuditInterceptor - Log HTTP requests as audit events
 */

import { Injectable } from '@hazeljs/core';
import type { Interceptor } from '@hazeljs/core';
import type { RequestContext } from '@hazeljs/core';
import { AuditService } from '../audit.service';

export interface AuditInterceptorOptions {
  /** Only audit these HTTP methods (default: all) */
  methods?: string[];
  /** Path patterns to skip (e.g. ['/health', '/metrics']) */
  excludePaths?: string[];
}

@Injectable()
export class AuditInterceptor implements Interceptor {
  constructor(private readonly auditService: AuditService) {}

  async intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown> {
    let result: 'success' | 'failure' = 'success';
    try {
      return await next();
    } catch (_err) {
      result = 'failure';
      throw _err;
    } finally {
      const action = context.method ? `http.${context.method.toLowerCase()}` : 'http.request';
      this.auditService.log(this.auditService.eventFromContext(context, result, action));
    }
  }
}
