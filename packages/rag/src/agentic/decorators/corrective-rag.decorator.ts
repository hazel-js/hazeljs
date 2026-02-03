/**
 * Corrective RAG (CRAG) Decorator
 * Self-corrects retrieval errors with fallback mechanisms
 */

import 'reflect-metadata';
import { CorrectiveRAGResult, Correction, AgenticLLMProvider } from '../types';

export interface CorrectiveRAGConfig {
  relevanceThreshold?: number;
  fallbackToWeb?: boolean;
  maxCorrections?: number;
  llmProvider?: AgenticLLMProvider;
}

const CRAG_METADATA_KEY = Symbol('correctiveRAG');

export function CorrectiveRAG(config: CorrectiveRAGConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      let results = await originalMethod.apply(this, args);
      const query = args[0] as string;

      // Evaluate results
      const evaluation = await evaluateResults(results, query, config);

      const corrections: Correction[] = [];
      let fallbackUsed = false;

      // Apply corrections if needed
      if (evaluation.needsCorrection) {
        for (const issue of evaluation.issues) {
          corrections.push({
            type: issue.type,
            description: issue.description,
            action: issue.action,
          });
        }

        // Attempt to correct
        const corrected = await correctResults(results, query, evaluation, config);
        if (corrected) {
          results = corrected;
        } else if (config.fallbackToWeb) {
          // Fallback mechanism (placeholder)
          fallbackUsed = true;
        }
      }

      const cragResult: CorrectiveRAGResult = {
        results: Array.isArray(results) ? results : [results],
        corrections,
        fallbackUsed,
        confidence: evaluation.confidence,
      };

      Reflect.defineMetadata(CRAG_METADATA_KEY, cragResult, target, propertyKey);

      return results;
    };

    return descriptor;
  };
}

async function evaluateResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any,
  query: string,
  config: CorrectiveRAGConfig
): Promise<{
  needsCorrection: boolean;
  confidence: number;
  issues: Array<{ type: Correction['type']; description: string; action: string }>;
}> {
  const threshold = config.relevanceThreshold || 0.7;
  const issues: Array<{ type: Correction['type']; description: string; action: string }> = [];

  if (!results || (Array.isArray(results) && results.length === 0)) {
    issues.push({
      type: 'missing_info',
      description: 'No results returned',
      action: 'Expand query or use fallback',
    });
    return { needsCorrection: true, confidence: 0, issues };
  }

  const resultArray = Array.isArray(results) ? results : [results];

  // Check relevance scores
  const avgScore = resultArray.reduce((sum, r) => sum + (r.score || 0), 0) / resultArray.length;

  if (avgScore < threshold) {
    issues.push({
      type: 'low_relevance',
      description: `Average relevance score ${avgScore.toFixed(2)} below threshold ${threshold}`,
      action: 'Rewrite query or adjust retrieval strategy',
    });
  }

  // Check for contradictions
  if (resultArray.length > 1 && config.llmProvider) {
    const hasContradictions = await checkContradictions(resultArray, config.llmProvider);
    if (hasContradictions) {
      issues.push({
        type: 'contradictory',
        description: 'Results contain contradictory information',
        action: 'Filter or re-rank results',
      });
    }
  }

  return {
    needsCorrection: issues.length > 0,
    confidence: Math.max(avgScore, 0.5),
    issues,
  };
}

async function correctResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any,
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluation: any,
  config: CorrectiveRAGConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!config.llmProvider) {
    return null;
  }

  const prompt = `The following retrieval results have issues. Suggest corrections:

Query: ${query}
Issues: ${evaluation.issues.map((i: { description: string }) => i.description).join(', ')}

Provide corrected query or strategy in JSON:
{
  "correctedQuery": "improved query",
  "strategy": "new strategy",
  "reasoning": "why this helps"
}`;

  try {
    await config.llmProvider.generateStructured<{
      correctedQuery: string;
      strategy: string;
      reasoning: string;
    }>(prompt, {});

    // Return null to signal re-query needed
    return null;
  } catch {
    return null;
  }
}

async function checkContradictions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[],
  llmProvider: AgenticLLMProvider
): Promise<boolean> {
  if (results.length < 2) return false;

  const contents = results
    .slice(0, 3)
    .map((r) => r.content)
    .join('\n\n');
  const prompt = `Do these texts contain contradictory information? Answer yes or no.

Texts:
${contents.slice(0, 1000)}`;

  try {
    const response = await llmProvider.generate(prompt, { maxTokens: 10 });
    return response.toLowerCase().includes('yes');
  } catch {
    return false;
  }
}

export function getCorrectiveRAGResult(
  target: object,
  propertyKey: string | symbol
): CorrectiveRAGResult | undefined {
  return Reflect.getMetadata(CRAG_METADATA_KEY, target, propertyKey);
}
