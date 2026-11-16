import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { HandlebarsAdapter } from './handlebars.adapter';

jest.mock('handlebars', () => ({
  compile: (src: string) => (ctx: Record<string, unknown>) =>
    src.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(ctx[key] ?? '')),
}));

describe('HandlebarsAdapter', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hazel-mail-'));
    writeFileSync(join(dir, 'welcome.hbs'), '<p>Hello {{name}}</p>');
    writeFileSync(join(dir, 'welcome.subject.hbs'), 'Welcome {{name}}');
    writeFileSync(join(dir, 'welcome.text.hbs'), 'Hello {{name}}');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('renders templates into an EmailDocument', () => {
    const adapter = new HandlebarsAdapter({ dir });
    const doc = adapter.toDocument('welcome', {
      to: ['a@b.com'],
      context: { name: 'Ada' },
      category: 'transactional',
      from: 'noreply@hazeljs.ai',
      cc: ['cc@b.com'],
      bcc: ['bcc@b.com'],
      locale: 'en',
      tags: { env: 'test' },
      idempotencyKey: 'idem',
      correlationId: 'corr',
      provider: 'memory',
    });
    expect(doc.subject).toBe('Welcome Ada');
    expect(doc.html).toContain('Hello Ada');
    expect(doc.text).toContain('Hello Ada');
    expect(doc.provider).toBe('memory');
  });

  it('throws when template is missing', () => {
    const adapter = new HandlebarsAdapter({ dir });
    expect(() => adapter.render('missing', {})).toThrow(/not found/);
  });
});
