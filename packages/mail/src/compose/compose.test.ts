import { email } from './compose';
import { renderHtml } from '../render/html.renderer';
import { renderText } from '../render/text.renderer';
import { DEFAULT_BRAND } from './brand';

describe('EmailComposer', () => {
  it('builds a structured EmailDocument', () => {
    const doc = email()
      .category('transactional')
      .subject('Welcome, Ada')
      .to('ada@example.com')
      .brand('default')
      .layout('marketing')
      .section({ heading: 'Welcome', body: 'Glad you are here.' })
      .cta({ label: 'Open dashboard', href: 'https://hazeljs.ai' })
      .unsubscribe({ url: 'https://hazeljs.ai/unsub' })
      .tags({ tenantId: 't1' })
      .build();

    expect(doc.subject).toBe('Welcome, Ada');
    expect(doc.to).toEqual(['ada@example.com']);
    expect(doc.sections).toHaveLength(1);
    expect(doc.cta?.label).toBe('Open dashboard');
  });

  it('requires subject and recipients', () => {
    expect(() => email().to('a@b.com').build()).toThrow(/subject/);
    expect(() => email().subject('Hi').build()).toThrow(/recipient/);
  });

  it('renders stable HTML and text', () => {
    const doc = email()
      .subject('Hello')
      .to('user@example.com')
      .section({ heading: 'Hi', body: 'Body line' })
      .cta({ label: 'Go', href: 'https://example.com' })
      .build();

    const html = renderHtml(doc, DEFAULT_BRAND);
    const text = renderText(doc, DEFAULT_BRAND);

    expect(html).toContain('Hi');
    expect(html).toContain('Body line');
    expect(html).toContain('https://example.com');
    expect(text).toContain('Hi');
    expect(text).toContain('Go: https://example.com');
    expect(html).toMatchSnapshot();
  });
});
