import { AuditLog } from './audit';

describe('AuditLog', () => {
  it('records events and invokes onAudit', () => {
    const seen: string[] = [];
    const log = new AuditLog({
      onAudit: (e) => seen.push(e.action),
    });
    log.record({ action: 'clone', path: '/tmp' });
    expect(log.list()).toHaveLength(1);
    expect(log.list()[0].path).toBe('/tmp');
    expect(seen).toEqual(['clone']);
  });

  it('drops old events beyond the limit', () => {
    const log = new AuditLog({ limit: 2 });
    log.record({ action: 'clone' });
    log.record({ action: 'pull' });
    log.record({ action: 'refresh' });
    expect(log.list().map((e) => e.action)).toEqual(['pull', 'refresh']);
    log.clear();
    expect(log.list()).toEqual([]);
  });
});
