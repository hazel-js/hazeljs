import type { LoadedSourceChunk, TokenBudgetStrategy } from '../types';
import { CagError } from '../errors/cag.error';

/** Matches @hazeljs/ai rough heuristic. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4) + 4;
}

export interface TokenBudgetResult {
  chunks: LoadedSourceChunk[];
  text: string;
  tokenCount: number;
  truncated: boolean;
  strategy: TokenBudgetStrategy;
}

export class TokenBudgetManager {
  constructor(
    private readonly maxTokens: number,
    private readonly strategy: TokenBudgetStrategy = 'priority',
    private readonly tokenCounter: (text: string) => number = estimateTokens,
    private readonly summarizer?: (text: string, maxTokens: number) => Promise<string> | string
  ) {}

  async apply(chunks: LoadedSourceChunk[]): Promise<TokenBudgetResult> {
    const withEstimates = chunks.map((c) => ({
      ...c,
      tokenEstimate: this.tokenCounter(c.content),
    }));

    const total = withEstimates.reduce((sum, c) => sum + c.tokenEstimate, 0);
    if (total <= this.maxTokens) {
      return {
        chunks: withEstimates,
        text: joinChunks(withEstimates),
        tokenCount: total,
        truncated: false,
        strategy: this.strategy,
      };
    }

    switch (this.strategy) {
      case 'reject':
        throw CagError.tokenBudgetExceeded(this.maxTokens, total);
      case 'truncate':
        return this.truncate(withEstimates);
      case 'compress':
      case 'summarize':
        return this.compressOrSummarize(withEstimates);
      case 'priority':
      default:
        return this.byPriority(withEstimates);
    }
  }

  private byPriority(chunks: LoadedSourceChunk[]): TokenBudgetResult {
    const sorted = [...chunks].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.id.localeCompare(b.id);
    });
    const kept: LoadedSourceChunk[] = [];
    let tokens = 0;
    for (const chunk of sorted) {
      if (tokens + chunk.tokenEstimate > this.maxTokens) {
        continue;
      }
      kept.push(chunk);
      tokens += chunk.tokenEstimate;
    }
    // Restore original relative order among kept
    const keptIds = new Set(kept.map((c) => c.id));
    const ordered = chunks.filter((c) => keptIds.has(c.id));
    return {
      chunks: ordered,
      text: joinChunks(ordered),
      tokenCount: ordered.reduce((s, c) => s + c.tokenEstimate, 0),
      truncated: true,
      strategy: 'priority',
    };
  }

  private truncate(chunks: LoadedSourceChunk[]): TokenBudgetResult {
    let remaining = this.maxTokens;
    const out: LoadedSourceChunk[] = [];
    for (const chunk of chunks) {
      if (remaining <= 0) break;
      if (chunk.tokenEstimate <= remaining) {
        out.push(chunk);
        remaining -= chunk.tokenEstimate;
      } else {
        const maxChars = Math.max(0, (remaining - 4) * 4);
        const truncatedContent = chunk.content.slice(0, maxChars);
        out.push({
          ...chunk,
          content: truncatedContent,
          tokenEstimate: this.tokenCounter(truncatedContent),
        });
        remaining = 0;
      }
    }
    return {
      chunks: out,
      text: joinChunks(out),
      tokenCount: out.reduce((s, c) => s + c.tokenEstimate, 0),
      truncated: true,
      strategy: 'truncate',
    };
  }

  private async compressOrSummarize(chunks: LoadedSourceChunk[]): Promise<TokenBudgetResult> {
    if (this.strategy === 'summarize' && this.summarizer) {
      const joined = joinChunks(chunks);
      const summarized = await this.summarizer(joined, this.maxTokens);
      const tokenCount = this.tokenCounter(summarized);
      if (tokenCount <= this.maxTokens) {
        return {
          chunks: [
            {
              id: '_summarized',
              content: summarized,
              priority: 100,
              compressible: true,
              tokenEstimate: tokenCount,
            },
          ],
          text: summarized,
          tokenCount,
          truncated: true,
          strategy: 'summarize',
        };
      }
    }
    // Fall back: drop compressible low-priority first, then priority select
    const protectedChunks = chunks.filter((c) => !c.compressible || c.priority >= 90);
    const compressible = chunks.filter((c) => c.compressible && c.priority < 90);
    const protectedTokens = protectedChunks.reduce((s, c) => s + c.tokenEstimate, 0);
    if (protectedTokens > this.maxTokens) {
      return this.byPriority(protectedChunks);
    }
    const remainingBudget = this.maxTokens - protectedTokens;
    const sorted = [...compressible].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.id.localeCompare(b.id);
    });
    const keptCompressible: LoadedSourceChunk[] = [];
    let used = 0;
    for (const chunk of sorted) {
      if (used + chunk.tokenEstimate > remainingBudget) continue;
      keptCompressible.push(chunk);
      used += chunk.tokenEstimate;
    }
    const keptIds = new Set([...protectedChunks, ...keptCompressible].map((c) => c.id));
    const ordered = chunks.filter((c) => keptIds.has(c.id));
    return {
      chunks: ordered,
      text: joinChunks(ordered),
      tokenCount: ordered.reduce((s, c) => s + c.tokenEstimate, 0),
      truncated: true,
      strategy: this.strategy,
    };
  }
}

function joinChunks(chunks: LoadedSourceChunk[]): string {
  return chunks
    .map((c) => c.content)
    .filter(Boolean)
    .join('\n\n');
}
