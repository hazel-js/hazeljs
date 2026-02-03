/**
 * HyDE (Hypothetical Document Embeddings) Decorator
 * Generates hypothetical documents to improve retrieval
 */

import 'reflect-metadata';
import { HyDEResult, AgenticLLMProvider } from '../types';

export interface HyDEConfig {
  generateHypothesis?: boolean;
  numHypotheses?: number;
  llmProvider?: AgenticLLMProvider;
}

const HYDE_METADATA_KEY = Symbol('hyde');

export function HyDE(config: HyDEConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const query = args[0] as string;

      if (!config.generateHypothesis || !config.llmProvider) {
        return originalMethod.apply(this, args);
      }

      // Generate hypothetical documents
      const hypotheses = await generateHypotheticalDocuments(
        query,
        config.numHypotheses || 3,
        config.llmProvider
      );

      // Retrieve using each hypothesis
      const allResults = [];
      const seenIds = new Set<string>();

      for (const hypothesis of hypotheses) {
        const results = await originalMethod.apply(this, [hypothesis, ...args.slice(1)]);

        if (Array.isArray(results)) {
          for (const result of results) {
            if (result.id && !seenIds.has(result.id)) {
              seenIds.add(result.id);
              allResults.push(result);
            }
          }
        }
      }

      // Re-rank by aggregated scores
      const reranked = rerankResults(allResults, hypotheses.length);

      const hydeResult: HyDEResult = {
        hypotheticalDocuments: hypotheses,
        retrievedResults: reranked,
        aggregatedScore: calculateAggregatedScore(reranked),
      };

      Reflect.defineMetadata(HYDE_METADATA_KEY, hydeResult, target, propertyKey);

      return reranked;
    };

    return descriptor;
  };
}

async function generateHypotheticalDocuments(
  query: string,
  count: number,
  llmProvider: AgenticLLMProvider
): Promise<string[]> {
  const prompt = `Generate ${count} hypothetical documents that would perfectly answer this query.
Each document should be detailed and comprehensive.

Query: ${query}

Generate ${count} hypothetical documents (one per line):`;

  try {
    const response = await llmProvider.generate(prompt, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    const documents = response
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter((line) => line.length > 50)
      .slice(0, count);

    return documents.length > 0 ? documents : [query];
  } catch {
    return [query];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rerankResults(results: any[], hypothesisCount: number): any[] {
  return results
    .map((result) => ({
      ...result,
      score: (result.score || 0) * (1 + 0.1 * hypothesisCount),
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateAggregatedScore(results: any[]): number {
  if (results.length === 0) return 0;

  const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
  return totalScore / results.length;
}

export function getHyDEResult(
  target: object,
  propertyKey: string | symbol
): HyDEResult | undefined {
  return Reflect.getMetadata(HYDE_METADATA_KEY, target, propertyKey);
}
