import { htmlToText } from './text.renderer';

describe('htmlToText', () => {
  it('strips tags and keeps links', () => {
    expect(htmlToText('<p>Hello</p><a href="https://x.com">Go</a>')).toContain(
      'Go (https://x.com)'
    );
  });
});
