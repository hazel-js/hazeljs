/// <reference types="jest" />
import { AuditModule } from './audit.module';
import { AuditService } from './audit.service';

describe('AuditModule', () => {
  beforeEach(() => {
    AuditService.configure({});
  });

  it('should return module from forRoot with no options', () => {
    const result = AuditModule.forRoot();
    expect(result).toBe(AuditModule);
  });

  it('should configure AuditService when options provided', () => {
    const transport = { log: jest.fn() };
    AuditModule.forRoot({ transports: [transport] });
    const service = new AuditService();
    service.log({ action: 'test' });
    expect(transport.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'test' }));
  });

  it('should return options from getOptions', () => {
    AuditModule.forRoot({ includeRequestContext: true });
    const opts = AuditModule.getOptions();
    expect(opts).toEqual({ includeRequestContext: true });
  });

  it('should return empty object when forRoot called with no options', () => {
    AuditModule.forRoot();
    const opts = AuditModule.getOptions();
    expect(opts).toEqual({});
  });
});
