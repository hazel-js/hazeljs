import type { AIMessage, AIMessageContentPart } from '../ai-enhanced.types';

/** Flatten message content to plain text (for token estimates and legacy providers). */
export function messageContentToText(content: string | AIMessageContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((p) => {
      if (p.type === 'text') {
        return p.text;
      }
      if (p.type === 'image_url') {
        return '[image]';
      }
      if (p.type === 'image_base64') {
        return '[image]';
      }
      if (p.type === 'input_audio') {
        return '[audio]';
      }
      return '';
    })
    .join(' ');
}

export function isMultipartContent(
  content: string | AIMessageContentPart[]
): content is AIMessageContentPart[] {
  return Array.isArray(content);
}
