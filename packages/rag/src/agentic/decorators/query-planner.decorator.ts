/**
 * Query Planner Decorator
 * Automatically decomposes complex queries into sub-queries
 */

import 'reflect-metadata';
import { QueryPlan, SubQuery, AgenticLLMProvider } from '../types';

export interface QueryPlannerConfig {
  decompose?: boolean;
  rewrite?: boolean;
  maxSubQueries?: number;
  parallel?: boolean;
  llmProvider?: AgenticLLMProvider;
}

const QUERY_PLANNER_METADATA_KEY = Symbol('queryPlanner');

export function QueryPlanner(config: QueryPlannerConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const query = args[0] as string;

      if (!config.decompose) {
        return originalMethod.apply(this, args);
      }

      // Decompose query into sub-queries
      const plan = await decomposeQuery(query, config);

      // Store plan in metadata
      Reflect.defineMetadata(QUERY_PLANNER_METADATA_KEY, plan, target, propertyKey);

      // Execute based on strategy
      if (plan.strategy === 'parallel' && config.parallel) {
        return executeParallel.call(this, plan, originalMethod, args);
      } else {
        return executeSequential.call(this, plan, originalMethod, args);
      }
    };

    return descriptor;
  };
}

/**
 * Decompose query into sub-queries
 */
async function decomposeQuery(query: string, config: QueryPlannerConfig): Promise<QueryPlan> {
  // Check if query is complex enough to decompose
  const complexity = estimateComplexity(query);

  if (complexity < 3) {
    return {
      originalQuery: query,
      subQueries: [
        {
          id: '1',
          query,
          type: 'factual',
          dependencies: [],
          priority: 1,
        },
      ],
      strategy: 'sequential',
      estimatedComplexity: complexity,
    };
  }

  // Use LLM to decompose if available
  if (config.llmProvider) {
    return decomposeWithLLM(query, config);
  }

  // Fallback to rule-based decomposition
  return decomposeRuleBased(query, config);
}

/**
 * LLM-based query decomposition
 */
async function decomposeWithLLM(query: string, config: QueryPlannerConfig): Promise<QueryPlan> {
  const prompt = `Decompose the following complex query into simpler sub-queries.
Each sub-query should be independent and focused on a specific aspect.

Query: ${query}

Provide the decomposition in the following JSON format:
{
  "subQueries": [
    {
      "id": "1",
      "query": "sub-query text",
      "type": "factual|analytical|comparative|temporal",
      "dependencies": [],
      "priority": 1
    }
  ],
  "strategy": "sequential|parallel"
}`;

  try {
    const result = await config.llmProvider!.generateStructured<{
      subQueries: SubQuery[];
      strategy: 'sequential' | 'parallel';
    }>(prompt, {});

    return {
      originalQuery: query,
      subQueries: result.subQueries.slice(0, config.maxSubQueries || 5),
      strategy: result.strategy,
      estimatedComplexity: result.subQueries.length,
    };
  } catch {
    return decomposeRuleBased(query, config);
  }
}

/**
 * Rule-based query decomposition
 */
function decomposeRuleBased(query: string, config: QueryPlannerConfig): QueryPlan {
  const subQueries: SubQuery[] = [];

  // Split by conjunctions
  const parts = query.split(/\band\b|\bor\b|\bthen\b/i);

  parts.forEach((part, index) => {
    const trimmed = part.trim();
    if (trimmed.length > 10) {
      subQueries.push({
        id: String(index + 1),
        query: trimmed,
        type: detectQueryType(trimmed),
        dependencies: index > 0 ? [String(index)] : [],
        priority: index + 1,
      });
    }
  });

  if (subQueries.length === 0) {
    subQueries.push({
      id: '1',
      query,
      type: 'factual',
      dependencies: [],
      priority: 1,
    });
  }

  return {
    originalQuery: query,
    subQueries: subQueries.slice(0, config.maxSubQueries || 5),
    strategy: subQueries.length > 1 ? 'parallel' : 'sequential',
    estimatedComplexity: subQueries.length,
  };
}

/**
 * Detect query type
 */
function detectQueryType(query: string): SubQuery['type'] {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('compare') || lowerQuery.includes('difference')) {
    return 'comparative';
  }
  if (lowerQuery.includes('when') || lowerQuery.includes('timeline')) {
    return 'temporal';
  }
  if (lowerQuery.includes('why') || lowerQuery.includes('how') || lowerQuery.includes('analyze')) {
    return 'analytical';
  }

  return 'factual';
}

/**
 * Estimate query complexity
 */
function estimateComplexity(query: string): number {
  let score = 1;

  // Length factor
  if (query.length > 100) score += 1;
  if (query.length > 200) score += 1;

  // Multiple questions
  const questionMarks = (query.match(/\?/g) || []).length;
  score += questionMarks;

  // Conjunctions
  const conjunctions = (query.match(/\band\b|\bor\b|\bthen\b/gi) || []).length;
  score += conjunctions;

  // Complex words
  const complexWords = ['compare', 'analyze', 'evaluate', 'synthesize'];
  complexWords.forEach((word) => {
    if (query.toLowerCase().includes(word)) score += 1;
  });

  return Math.min(score, 10);
}

/**
 * Execute sub-queries in parallel
 */
async function executeParallel(
  this: unknown,
  plan: QueryPlan,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  originalMethod: Function,
  args: unknown[]
): Promise<unknown> {
  const results = await Promise.all(
    plan.subQueries.map((subQuery) =>
      originalMethod.apply(this, [subQuery.query, ...args.slice(1)])
    )
  );

  // Merge results
  return mergeResults(results, plan);
}

/**
 * Execute sub-queries sequentially
 */
async function executeSequential(
  this: unknown,
  plan: QueryPlan,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  originalMethod: Function,
  args: unknown[]
): Promise<unknown> {
  const results = [];

  for (const subQuery of plan.subQueries) {
    const result = await originalMethod.apply(this, [subQuery.query, ...args.slice(1)]);
    results.push(result);
  }

  return mergeResults(results, plan);
}

/**
 * Merge results from sub-queries
 */
function mergeResults(results: unknown[], _plan: QueryPlan): unknown[] {
  if (!Array.isArray(results[0])) {
    return results;
  }

  // Flatten and deduplicate search results
  const allResults = results.flat();
  const seen = new Set<string>();
  const merged: unknown[] = [];

  for (const result of allResults) {
    if (
      typeof result === 'object' &&
      result !== null &&
      'id' in result &&
      typeof (result as { id: unknown }).id === 'string'
    ) {
      const id = (result as { id: string }).id;
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(result);
      }
    }
  }

  return merged;
}

/**
 * Get query plan metadata
 */
export function getQueryPlan(target: object, propertyKey: string | symbol): QueryPlan | undefined {
  return Reflect.getMetadata(QUERY_PLANNER_METADATA_KEY, target, propertyKey);
}
