import type { AIMessageContentPart } from '../ai-enhanced.types';
import { isMultipartContent, messageContentToText } from './message-content';

describe('messageContentToText', () => {
  it('returns string content as-is', () => {
    expect(messageContentToText('hello')).toBe('hello');
  });

  it('flattens text parts', () => {
    expect(
      messageContentToText([
        { type: 'text', text: 'a' },
        { type: 'text', text: 'b' },
      ])
    ).toBe('a b');
  });

  it('maps image_url and image_base64 to placeholders', () => {
    expect(
      messageContentToText([
        { type: 'image_url', imageUrl: 'http://x' },
        { type: 'image_base64', base64: 'e30=', mimeType: 'image/png' },
      ])
    ).toBe('[image] [image]');
  });

  it('maps input_audio to placeholder', () => {
    expect(
      messageContentToText([{ type: 'input_audio', base64: 'x', mimeType: 'audio/wav' }])
    ).toBe('[audio]');
  });

  it('ignores unknown part types', () => {
    const notInUnion = { type: 'other' } as unknown as AIMessageContentPart;
    expect(messageContentToText([{ type: 'text', text: 'ok' }, notInUnion])).toBe('ok ');
  });
});

describe('isMultipartContent', () => {
  it('narrows arrays', () => {
    const c = [{ type: 'text' as const, text: 't' }];
    expect(isMultipartContent(c)).toBe(true);
  });

  it('returns false for strings', () => {
    expect(isMultipartContent('plain')).toBe(false);
  });
});
