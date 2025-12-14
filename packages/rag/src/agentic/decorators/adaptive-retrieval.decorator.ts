/**
 * Adaptive Retrieval Decorator
 * Automatically selects the best retrieval strategy
 */

import 'reflect-metadata';
import { AdaptiveStrategyResult, AgenticLLMProvider } from '../types';
import { RetrievalStrategy } from '../../types';

export interface AdaptiveRetrievalConfig {
  strategies?: RetrievalStrategy[];
  autoSelect?: boolean;
  contextAware?: boolean;
  llmProvider?: AgenticLLMProvider;
}

const ADAPTIVE_METADATA_KEY = Symbol('adaptive');

export function AdaptiveRetrieval(config: AdaptiveRetrievalConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const query = args[0] as string;

      if (!config.autoSelect) {
        return originalMethod.apply(this, args);
      }

      // Select best strategy
      const strategyResult = await selectStrategy(query, config);

      // Store metadata
      Reflect.defineMetadata(ADAPTIVE_METADATA_KEY, strategyResult, target, propertyKey);

      // Execute with selected strategy
      const modifiedArgs = [...args];
      if (modifiedArgs[1] && typeof modifiedArgs[1] === 'object') {
        modifiedArgs[1] = { ...modifiedArgs[1], strategy: strategyResult.selectedStrategy };
      }

      return originalMethod.apply(this, modifiedArgs);
    };

    return descriptor;
  };
}

async function selectStrategy(
  query: string,
  config: AdaptiveRetrievalConfig
): Promise<AdaptiveStrategyResult> {
  const strategies = config.strategies || [
    RetrievalStrategy.SIMILARITY,
    RetrievalStrategy.HYBRID,
    RetrievalStrategy.MMR,
  ];

  if (config.llmProvider) {
    return selectStrategyWithLLM(query, strategies, config);
  }

  return selectStrategyHeuristic(query, strategies);
}

async function selectStrategyWithLLM(
  query: string,
  strategies: RetrievalStrategy[],
  config: AdaptiveRetrievalConfig
): Promise<AdaptiveStrategyResult> {
  const prompt = `Select the best retrieval strategy for this query:

Query: ${query}

Available strategies:
- similarity: Best for semantic similarity
- hybrid: Combines keyword and semantic search
- mmr: Maximizes diversity while maintaining relevance

Respond in JSON:
{
  "selectedStrategy": "similarity|hybrid|mmr",
  "reason": "explanation",
  "confidence": 0.0-1.0
}`;

  try {
    const result = await config.llmProvider!.generateStructured<{
      selectedStrategy: string;
      reason: string;
      confidence: number;
    }>(prompt, {});

    return {
      ...result,
      alternatives: strategies
        .filter((s) => s !== result.selectedStrategy)
        .map((s) => ({ strategy: s, score: 0.5 })),
    };
  } catch {
    return selectStrategyHeuristic(query, strategies);
  }
}

function selectStrategyHeuristic(
  query: string,
  strategies: RetrievalStrategy[]
): AdaptiveStrategyResult {
  const lowerQuery = query.toLowerCase();

  // Check for diversity needs
  if (
    lowerQuery.includes('different') ||
    lowerQuery.includes('various') ||
    lowerQuery.includes('diverse')
  ) {
    return {
      selectedStrategy: RetrievalStrategy.MMR,
      reason: 'Query requires diverse results',
      confidence: 0.8,
      alternatives: strategies
        .filter((s) => s !== RetrievalStrategy.MMR)
        .map((s) => ({ strategy: s, score: 0.5 })),
    };
  }

  // Check for keyword-heavy queries
  const hasSpecificTerms = /\b(exact|specific|precise|"[^"]+")/.test(query);
  if (hasSpecificTerms) {
    return {
      selectedStrategy: RetrievalStrategy.HYBRID,
      reason: 'Query contains specific terms requiring keyword matching',
      confidence: 0.85,
      alternatives: strategies
        .filter((s) => s !== RetrievalStrategy.HYBRID)
        .map((s) => ({ strategy: s, score: 0.6 })),
    };
  }

  // Default to similarity
  return {
    selectedStrategy: RetrievalStrategy.SIMILARITY,
    reason: 'General semantic search',
    confidence: 0.7,
    alternatives: strategies
      .filter((s) => s !== RetrievalStrategy.SIMILARITY)
      .map((s) => ({ strategy: s, score: 0.5 })),
  };
}

export function getAdaptiveStrategy(
  target: object,
  propertyKey: string | symbol
): AdaptiveStrategyResult | undefined {
  return Reflect.getMetadata(ADAPTIVE_METADATA_KEY, target, propertyKey);
}
