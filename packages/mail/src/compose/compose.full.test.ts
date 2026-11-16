import { email } from './compose';

describe('EmailComposer full builder surface', () => {
  it('sets all optional fields', () => {
    const doc = email()
      .category('marketing')
      .subject('Full')
      .to(['a@b.com', { name: 'C', address: 'c@d.com' }])
      .cc('cc@example.com')
      .bcc([{ address: 'bcc@example.com' }])
      .from({ name: 'Hazel', address: 'noreply@hazeljs.ai' })
      .replyTo('support@hazeljs.ai')
      .brand('acme')
      .layout('plain')
      .sections([
        { heading: 'One', body: 'First' },
        { body: 'Second', html: '<p>Second</p>' },
      ])
      .html('<p>override</p>')
      .text('override text')
      .attach({ filename: 'a.txt', content: 'hi', contentType: 'text/plain' })
      .headers({ 'X-Test': '1' })
      .tags({ campaign: 'spring' })
      .metadata({ source: 'test' })
      .idempotencyKey('idem-1')
      .locale('en-US')
      .provider('sendgrid')
      .correlationId('corr-1')
      .build();

    expect(doc.cc).toEqual(['cc@example.com']);
    expect(doc.bcc).toHaveLength(1);
    expect(doc.from).toEqual({ name: 'Hazel', address: 'noreply@hazeljs.ai' });
    expect(doc.replyTo).toBe('support@hazeljs.ai');
    expect(doc.brand).toBe('acme');
    expect(doc.layout).toBe('plain');
    expect(doc.sections).toHaveLength(2);
    expect(doc.html).toBe('<p>override</p>');
    expect(doc.text).toBe('override text');
    expect(doc.attachments?.[0]?.filename).toBe('a.txt');
    expect(doc.headers?.['X-Test']).toBe('1');
    expect(doc.tags?.campaign).toBe('spring');
    expect(doc.metadata?.source).toBe('test');
    expect(doc.idempotencyKey).toBe('idem-1');
    expect(doc.locale).toBe('en-US');
    expect(doc.provider).toBe('sendgrid');
    expect(doc.correlationId).toBe('corr-1');
  });
});
