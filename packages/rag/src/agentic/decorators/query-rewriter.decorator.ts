/**
 * Query Rewriter Decorator
 * Rewrites and expands queries for better retrieval
 */

import 'reflect-metadata';
import { AgenticLLMProvider } from '../types';

export interface QueryRewriterConfig {
  techniques?: ('expansion' | 'clarification' | 'synonym' | 'decomposition')[];
  llmBased?: boolean;
  llmProvider?: AgenticLLMProvider;
  maxVariations?: number;
}

const REWRITER_METADATA_KEY = Symbol('queryRewriter');

export function QueryRewriter(config: QueryRewriterConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const query = args[0] as string;

      // Generate query variations
      const variations = await generateQueryVariations(query, config);

      // Execute search with all variations
      const allResults = [];
      const seenIds = new Set<string>();

      for (const variation of variations) {
        const results = await originalMethod.apply(this, [variation, ...args.slice(1)]);

        if (Array.isArray(results)) {
          for (const result of results) {
            if (result.id && !seenIds.has(result.id)) {
              seenIds.add(result.id);
              allResults.push(result);
            }
          }
        }
      }

      // Re-rank by frequency across variations
      const ranked = rerankByFrequency(allResults, variations.length);

      Reflect.defineMetadata(REWRITER_METADATA_KEY, variations, target, propertyKey);

      return ranked;
    };

    return descriptor;
  };
}

async function generateQueryVariations(
  query: string,
  config: QueryRewriterConfig
): Promise<string[]> {
  const variations = [query]; // Always include original
  const techniques = config.techniques || ['expansion', 'synonym'];
  const maxVariations = config.maxVariations || 3;

  if (config.llmBased && config.llmProvider) {
    return generateWithLLM(query, techniques, config.llmProvider, maxVariations);
  }

  // Rule-based variations
  for (const technique of techniques) {
    switch (technique) {
      case 'expansion':
        variations.push(...expandQuery(query));
        break;
      case 'synonym':
        variations.push(...addSynonyms(query));
        break;
      case 'clarification':
        variations.push(...clarifyQuery(query));
        break;
    }
  }

  return [...new Set(variations)].slice(0, maxVariations + 1);
}

async function generateWithLLM(
  query: string,
  techniques: string[],
  llmProvider: AgenticLLMProvider,
  maxVariations: number
): Promise<string[]> {
  const prompt = `Generate ${maxVariations} variations of this query using these techniques: ${techniques.join(', ')}

Original Query: ${query}

Generate ${maxVariations} query variations (one per line):`;

  try {
    const response = await llmProvider.generate(prompt, { temperature: 0.7 });
    const variations = response
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter((line) => line.length > 5)
      .slice(0, maxVariations);

    return [query, ...variations];
  } catch {
    return [query];
  }
}

function expandQuery(query: string): string[] {
  const expansions: string[] = [];

  // Add question words if not present
  if (!query.match(/^(what|who|where|when|why|how)/i)) {
    expansions.push(`What is ${query}?`);
    expansions.push(`How does ${query} work?`);
  }

  // Add context
  expansions.push(`${query} explanation`);
  expansions.push(`${query} details`);

  return expansions;
}

function addSynonyms(query: string): string[] {
  const synonymMap: Record<string, string[]> = {
    find: ['search', 'locate', 'discover'],
    show: ['display', 'present', 'demonstrate'],
    explain: ['describe', 'clarify', 'elaborate'],
    compare: ['contrast', 'differentiate', 'analyze'],
  };

  const variations: string[] = [];
  const words = query.split(/\s+/);

  words.forEach((word, index) => {
    const lowerWord = word.toLowerCase();
    if (synonymMap[lowerWord]) {
      synonymMap[lowerWord].forEach((synonym) => {
        const newWords = [...words];
        newWords[index] = synonym;
        variations.push(newWords.join(' '));
      });
    }
  });

  return variations;
}

function clarifyQuery(query: string): string[] {
  const clarifications: string[] = [];

  // Add specificity
  if (query.length < 50) {
    clarifications.push(`${query} with examples`);
    clarifications.push(`${query} in detail`);
  }

  return clarifications;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rerankByFrequency(results: any[], variationCount: number): any[] {
  const frequency = new Map<string, number>();

  results.forEach((result: { id: string }) => {
    frequency.set(result.id, (frequency.get(result.id) || 0) + 1);
  });

  return results
    .map((result: { id: string; score?: number }) => ({
      ...result,
      score: (result.score || 0) * (1 + (frequency.get(result.id) || 0) / variationCount),
    }))
    .sort((a: { score?: number }, b: { score?: number }) => (b.score || 0) - (a.score || 0));
}

export function getQueryVariations(target: object, propertyKey: string | symbol): string[] {
  return Reflect.getMetadata(REWRITER_METADATA_KEY, target, propertyKey) || [];
}
