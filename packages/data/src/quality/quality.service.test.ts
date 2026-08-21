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
    service.registerCheck('custom', (_data) => ({
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

  it('pattern check with custom message', () => {
    const check = service.pattern('code', /^[A-Z]+$/, 'Must be uppercase');
    const result = check([{ code: 'abc' }]);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Must be uppercase');
  });

  it('range check with only min', () => {
    const check = service.range('age', { min: 18 });
    expect(check([{ age: 25 }]).passed).toBe(true);
    expect(check([{ age: 10 }]).passed).toBe(false);
  });

  it('range check with only max', () => {
    const check = service.range('age', { max: 65 });
    expect(check([{ age: 50 }]).passed).toBe(true);
    expect(check([{ age: 100 }]).passed).toBe(false);
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
    const records = [{ value: 10 }, { value: 11 }, { value: 12 }, { value: 1000 }];
    const anomalies = service.detectAnomalies(records, ['value'], 1.5);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.value === 1000)).toBe(true);
  });

  it('completeness skips non-object items and returns passed when no objects processed', () => {
    const check = service.completeness(['email']);
    const result = check('not an object');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('runChecks handles check throwing', async () => {
    service.registerCheck('throws', () => {
      throw new Error('Check failed');
    });
    const report = await service.runChecks('ds', [{}]);
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].passed).toBe(false);
    expect(report.checks[0].message).toBe('Check failed');
  });

  it('runChecks handles check throwing non-Error', async () => {
    service.registerCheck('throws', () => {
      throw 'string error';
    });
    const report = await service.runChecks('ds', [{}]);
    expect(report.checks[0].message).toBe('Check failed');
  });

  it('runChecks with no checks returns score 100', async () => {
    const report = await service.runChecks('ds', [{}]);
    expect(report.score).toBe(100);
  });

  it('profile returns empty for empty records', () => {
    const profile = service.profile('empty', []);
    expect(profile.totalRows).toBe(0);
    expect(profile.fields).toEqual({});
  });

  it('freshness check', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const check = service.freshness('updatedAt', 60_000, { now });
    expect(check([{ updatedAt: '2024-01-01T11:59:30Z' }]).passed).toBe(true);
    expect(check([{ updatedAt: '2024-01-01T11:00:00Z' }]).passed).toBe(false);
  });

  it('freshness marks missing and invalid timestamps as stale', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const check = service.freshness('updatedAt', 60_000, { now });
    expect(check([{ updatedAt: null }]).passed).toBe(false);
    expect(check([{ updatedAt: 'not-a-date' }]).passed).toBe(false);
    expect(check([{ updatedAt: now.getTime() - 1000 }]).passed).toBe(true);
    expect(check([{ updatedAt: new Date(now.getTime() - 1000) }]).passed).toBe(true);
    expect(check([null as unknown as object]).passed).toBe(true);
  });

  it('rowCount check', () => {
    const check = service.rowCount({ min: 1, max: 2 });
    expect(check([{ a: 1 }]).passed).toBe(true);
    expect(check([]).passed).toBe(false);
    expect(check([{}, {}, {}]).passed).toBe(false);
  });

  it('schemaDrift check', () => {
    const check = service.schemaDrift(['id', 'name']);
    expect(check([{ id: 1, name: 'a' }]).passed).toBe(true);
    expect(check([{ id: 1 }]).passed).toBe(false);
    expect(check([{ id: 1, name: 'a', extra: 1 }]).passed).toBe(false);
  });

  it('detectAnomaliesIQR flags outliers', () => {
    const records = [{ v: 10 }, { v: 11 }, { v: 12 }, { v: 13 }, { v: 14 }, { v: 100 }];
    const anomalies = service.detectAnomaliesIQR(records, ['v']);
    expect(anomalies.some((a) => a.value === 100)).toBe(true);
    expect(anomalies[0].method).toBe('iqr');
  });

  it('detectAnomaliesMAD flags outliers', () => {
    const records = [{ v: 10 }, { v: 11 }, { v: 12 }, { v: 13 }, { v: 14 }, { v: 200 }];
    const anomalies = service.detectAnomaliesMAD(records, ['v']);
    expect(anomalies.some((a) => a.value === 200)).toBe(true);
    expect(anomalies[0].method).toBe('mad');
  });
});
