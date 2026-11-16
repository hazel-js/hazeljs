import { inlineSimpleStyles } from './css-inline';

describe('inlineSimpleStyles', () => {
  it('inlines class styles', () => {
    const html = inlineSimpleStyles('<div class="btn primary">Go</div>', {
      '.btn': 'padding:8px',
    });
    expect(html).toContain('style="padding:8px"');
  });
});
