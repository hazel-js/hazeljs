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

  it('report includes quality score', async () => {
    service.registerCheck('custom', (data) => ({
      name: 'custom',
      passed: true,
      score: 100,
    }));
    const report = await service.runChecks('ds', [{}]);
    expect(report.score).toBe(100);
  });

  it('uniqueness check', () => {
    const check = service.uniqueness(['id']);
    expect(check([{ id: 1 }, { id: 2 }]).passed).toBe(true);
    expect(check([{ id: 1 }, { id: 1 }]).passed).toBe(false);
  });

  it('range check', () => {
    const check = service.range('age', { min: 0, max: 120 });
    expect(check([{ age: 25 }]).passed).toBe(true);
    expect(check([{ age: 150 }]).passed).toBe(false);
  });

  it('pattern check', () => {
    const check = service.pattern('phone', /^\d{10}$/);
    expect(check([{ phone: '1234567890' }]).passed).toBe(true);
    expect(check([{ phone: '123' }]).passed).toBe(false);
  });

  it('referentialIntegrity check', () => {
    const check = service.referentialIntegrity('status', ['active', 'inactive']);
    expect(check([{ status: 'active' }]).passed).toBe(true);
    expect(check([{ status: 'unknown' }]).passed).toBe(false);
  });

  it('profile returns field stats', () => {
    const records = [
      { name: 'a', age: 10 },
      { name: 'b', age: 20 },
      { name: 'c', age: 30 },
    ];
    const profile = service.profile('test', records);
    expect(profile.totalRows).toBe(3);
    expect(profile.fields).toHaveProperty('name');
    expect(profile.fields).toHaveProperty('age');
    expect(profile.fields.age.mean).toBe(20);
  });

  it('detectAnomalies flags outliers', () => {
    const records = [
      { value: 10 },
      { value: 11 },
      { value: 12 },
      { value: 1000 },
    ];
    const anomalies = service.detectAnomalies(records, ['value'], 1.5);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.value === 1000)).toBe(true);
  });
});
