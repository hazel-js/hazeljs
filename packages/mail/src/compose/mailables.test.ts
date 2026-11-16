import { z } from 'zod';
import { defineMailable, MailCatalog } from './mailables';

describe('MailCatalog', () => {
  it('registers and renders mailables', () => {
    const catalog = new MailCatalog();
    const Hello = defineMailable({
      name: 'hello',
      schema: z.object({ name: z.string() }),
      build: (data, { email }) =>
        email().subject(`Hi ${data.name}`).to('x@y.com').section({ body: data.name }).build(),
    });
    catalog.register(Hello);
    expect(catalog.list()).toEqual(['hello']);
    const doc = catalog.renderTo('hello', 'a@b.com', { name: 'Ada' });
    expect(doc.to).toEqual(['a@b.com']);
    expect(doc.subject).toBe('Hi Ada');
  });

  it('throws for unknown mailables', () => {
    const catalog = new MailCatalog();
    expect(() => catalog.render('missing', {})).toThrow(/not registered/);
  });
});
