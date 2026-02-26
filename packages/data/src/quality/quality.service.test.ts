import { QualityService } from './quality.service';

describe('QualityService', () => {
  let service: QualityService;

  beforeEach(() => {
    service = new QualityService();
  });

  it('runs registered checks', async () => {
    service.registerCheck('custom', (data) => ({
      name: 'custom',
      passed: (data as { ok?: boolean }).ok === true,
    }));

    const report = await service.runChecks('test', { ok: true });
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].passed).toBe(true);
    expect(report.passed).toBe(true);
  });

  it('completeness check', () => {
    const check = service.completeness(['email', 'name']);
    expect(check({ email: 'a@b.com', name: 'x' }).passed).toBe(true);
    expect(check({ email: 'a@b.com' }).passed).toBe(false);
  });

  it('notNull check', () => {
    const check = service.notNull(['id']);
    expect(check({ id: 1 }).passed).toBe(true);
    expect(check({ id: null }).passed).toBe(false);
  });

  it('report includes totalRows', async () => {
    service.registerCheck('dummy', () => ({ name: 'dummy', passed: true }));
    const report = await service.runChecks('ds', [{}, {}]);
    expect(report.totalRows).toBe(2);
  });
});
