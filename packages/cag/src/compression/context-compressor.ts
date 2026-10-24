import type { LoadedSourceChunk } from '../types';
import { estimateTokens } from '../budget/token-budget';

export interface CompressionResult {
  chunks: LoadedSourceChunk[];
  ratio: number;
}

/**
 * Optional compression pipeline: dedupe → normalize → (optional semantic).
 * Sources with compressible:false or priority >= 90 are never rewritten.
 */
export class ContextCompressor {
  constructor(
    private readonly enabled: boolean,
    private readonly semanticCompressor?: (text: string) => Promise<string> | string,
    private readonly tokenCounter: (text: string) => number = estimateTokens
  ) {}

  async compress(chunks: LoadedSourceChunk[]): Promise<CompressionResult> {
    if (!this.enabled) {
      return { chunks, ratio: 1 };
    }

    const beforeTokens = chunks.reduce((s, c) => s + this.tokenCounter(c.content), 0);
    const seen = new Set<string>();
    const out: LoadedSourceChunk[] = [];

    for (const chunk of chunks) {
      const protectedChunk = chunk.compressible === false || chunk.priority >= 90;
      let content = chunk.content;

      if (!protectedChunk) {
        content = normalizeWhitespace(content);
        const dedupeKey = content.trim().toLowerCase();
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);

        if (this.semanticCompressor) {
          content = await this.semanticCompressor(content);
          content = normalizeWhitespace(content);
        }
      } else {
        const dedupeKey = content.trim().toLowerCase();
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
      }

      out.push({
        ...chunk,
        content,
        tokenEstimate: this.tokenCounter(content),
      });
    }

    const afterTokens = out.reduce((s, c) => s + this.tokenCounter(c.content), 0);
    const ratio = beforeTokens === 0 ? 1 : afterTokens / beforeTokens;
    return { chunks: out, ratio };
  }
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
