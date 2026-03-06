import { checkToxicity } from './toxicity.check';

describe('toxicity.check', () => {
  it('should detect harmful keywords', () => {
    const result = checkToxicity('How to make illegal drugs');
    expect(result.detected).toBe(true);
    expect(result.matchedPattern).toBeDefined();
  });

  it('should detect hate speech phrase', () => {
    const result = checkToxicity('This is hate speech content');
    expect(result.detected).toBe(true);
  });

  it('should allow normal text', () => {
    const result = checkToxicity('Hello, how are you today?');
    expect(result.detected).toBe(false);
  });

  it('should use custom keywords', () => {
    const result = checkToxicity('The banned word appears here', {
      useDefaults: false,
      customKeywords: ['banned word'],
    });
    expect(result.detected).toBe(true);
    expect(result.matchedPattern).toBe('banned word');
  });

  it('should combine defaults with custom keywords', () => {
    const result = checkToxicity('custom bad word', {
      useDefaults: false,
      customKeywords: ['custom bad word'],
    });
    expect(result.detected).toBe(true);
  });

  it('should escape special regex chars in custom keywords', () => {
    const result = checkToxicity('price is x.y dollars', {
      useDefaults: false,
      customKeywords: ['x.y'],
    });
    expect(result.detected).toBe(true);
    expect(result.matchedPattern).toBe('x.y');
  });

  it('should return false when useDefaults false and no matches', () => {
    const result = checkToxicity('harmful content', {
      useDefaults: false,
      customPatterns: [],
      customKeywords: [],
    });
    expect(result.detected).toBe(false);
  });
});
