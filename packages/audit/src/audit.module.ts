/**
 * AuditModule - Audit logging for HazelJS
 */

import { HazelModule } from '@hazeljs/core';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import type { AuditModuleOptions } from './audit.types';

export const AUDIT_SERVICE_TOKEN = 'AuditService';

@HazelModule({
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {
  private static options: AuditModuleOptions = {};

  static forRoot(options?: AuditModuleOptions): typeof AuditModule {
    AuditModule.options = options ?? {};
    if (options) {
      AuditService.configure(options);
    }
    return AuditModule;
  }

  static getOptions(): AuditModuleOptions {
    return AuditModule.options;
  }
}
