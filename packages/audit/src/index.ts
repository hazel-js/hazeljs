/**
 * @hazeljs/audit - Audit logging and event trail for HazelJS
 */

export { AuditModule, AUDIT_SERVICE_TOKEN } from './audit.module';
export { AuditService } from './audit.service';
export { AuditInterceptor } from './interceptors/audit.interceptor';
export { ConsoleAuditTransport } from './transports/console.transport';
export { FileAuditTransport } from './transports/file.transport';
export { KafkaAuditTransport } from './transports/kafka.transport';
export { Audit, getAuditMetadata, hasAuditMetadata } from './decorators/audit.decorator';

export type { AuditEvent, AuditActor, AuditTransport, AuditModuleOptions } from './audit.types';
export type { AuditDecoratorOptions } from './decorators/audit.decorator';
export type { AuditInterceptorOptions } from './interceptors/audit.interceptor';
export type { FileAuditTransportOptions } from './transports/file.transport';
export type {
  KafkaAuditTransportOptions,
  KafkaAuditSender,
  KafkaAuditSerializer,
} from './transports/kafka.transport';
