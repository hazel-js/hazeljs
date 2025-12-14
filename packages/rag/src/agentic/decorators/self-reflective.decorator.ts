/**
 * Self-Reflective Decorator
 * Evaluates and iteratively improves retrieval results
 */

import 'reflect-metadata';
import { ReflectionResult, QualityAssessment, AgenticLLMProvider } from '../types';

export interface SelfReflectiveConfig {
  maxIterations?: number;
  qualityThreshold?: number;
  llmProvider?: AgenticLLMProvider;
  enableAutoImprovement?: boolean;
}

const REFLECTION_METADATA_KEY = Symbol('reflection');

export function SelfReflective(config: SelfReflectiveConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const maxIterations = config.maxIterations || 3;
      const threshold = config.qualityThreshold || 0.8;

      let iteration = 0;
      let currentResult = await originalMethod.apply(this, args);
      let bestResult = currentResult;
      let bestQuality = 0;

      const reflections: ReflectionResult[] = [];

      while (iteration < maxIterations) {
        iteration++;

        // Assess quality
        const query = args[0] as string;
        const quality = await assessQuality(currentResult, query, config);

        reflections.push({
          originalResponse: JSON.stringify(currentResult),
          quality,
          improvements: quality.issues,
          iterations: iteration,
        });

        // Track best result
        if (quality.score > bestQuality) {
          bestQuality = quality.score;
          bestResult = currentResult;
        }

        // Check if quality threshold met
        if (quality.score >= threshold) {
          break;
        }

        // Attempt improvement
        if (config.enableAutoImprovement && config.llmProvider) {
          const improved = await improveResults(currentResult, quality, query, config);

          if (improved) {
            currentResult = improved;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // Store reflection metadata
      Reflect.defineMetadata(REFLECTION_METADATA_KEY, reflections, target, propertyKey);

      return bestResult;
    };

    return descriptor;
  };
}

/**
 * Assess quality of results
 */
async function assessQuality(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any,
  query: string,
  config: SelfReflectiveConfig
): Promise<QualityAssessment> {
  if (config.llmProvider) {
    return assessQualityWithLLM(results, query, config);
  }

  return assessQualityHeuristic(results, query);
}

/**
 * LLM-based quality assessment
 */
async function assessQualityWithLLM(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any,
  query: string,
  config: SelfReflectiveConfig
): Promise<QualityAssessment> {
  const resultsStr = JSON.stringify(results, null, 2);

  const prompt = `Evaluate the quality of these search results for the given query.

Query: ${query}

Results: ${resultsStr.slice(0, 2000)}

Assess the following aspects (0-1 scale):
1. Relevance: How relevant are the results to the query?
2. Completeness: Do the results fully answer the query?
3. Accuracy: Are the results factually accurate?
4. Clarity: Are the results clear and well-structured?

Provide assessment in JSON format:
{
  "relevance": 0.0-1.0,
  "completeness": 0.0-1.0,
  "accuracy": 0.0-1.0,
  "clarity": 0.0-1.0,
  "issues": ["issue1", "issue2"]
}`;

  try {
    const assessment = await config.llmProvider!.generateStructured<{
      relevance: number;
      completeness: number;
      accuracy: number;
      clarity: number;
      issues: string[];
    }>(prompt, {});

    const score =
      (assessment.relevance + assessment.completeness + assessment.accuracy + assessment.clarity) /
      4;

    return {
      score,
      ...assessment,
    };
  } catch {
    return assessQualityHeuristic(results, query);
  }
}

/**
 * Heuristic-based quality assessment
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assessQualityHeuristic(results: any, query: string): QualityAssessment {
  const issues: string[] = [];
  let relevance = 0.5;
  let completeness = 0.5;
  const accuracy = 0.8;
  let clarity = 0.7;

  // Check if results exist
  if (!results || (Array.isArray(results) && results.length === 0)) {
    issues.push('No results returned');
    relevance = 0;
    completeness = 0;
    return { score: 0, relevance, completeness, accuracy, clarity, issues };
  }

  // Check result count
  const resultCount = Array.isArray(results) ? results.length : 1;
  if (resultCount < 3) {
    issues.push('Few results returned');
    completeness = 0.5;
  } else if (resultCount >= 5) {
    completeness = 0.9;
  }

  // Check for query terms in results
  const queryTerms = query.toLowerCase().split(/\s+/);
  let matchCount = 0;

  if (Array.isArray(results)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (results as any[]).forEach((result: { content?: string }) => {
      const content = (result.content || '').toLowerCase();
      queryTerms.forEach((term) => {
        if (content.includes(term)) matchCount++;
      });
    });

    relevance = Math.min(matchCount / (queryTerms.length * resultCount), 1);
  }

  if (relevance < 0.3) {
    issues.push('Low relevance to query');
  }

  // Check for diversity
  if (Array.isArray(results) && results.length > 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueContent = new Set<string | undefined>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (results as any[]).map((r: { content?: string }) => r.content?.slice(0, 100))
    );
    if (uniqueContent.size < results.length * 0.7) {
      issues.push('Low diversity in results');
      clarity = 0.6;
    }
  }

  const score = (relevance + completeness + accuracy + clarity) / 4;

  return { score, relevance, completeness, accuracy, clarity, issues };
}

/**
 * Improve results based on quality assessment
 */
async function improveResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any,
  quality: QualityAssessment,
  query: string,
  config: SelfReflectiveConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!config.llmProvider) {
    return null;
  }

  const prompt = `The following search results have quality issues. Suggest an improved query or retrieval strategy.

Original Query: ${query}
Quality Issues: ${quality.issues.join(', ')}
Current Results: ${JSON.stringify(results, null, 2).slice(0, 1000)}

Suggest improvements in JSON format:
{
  "improvedQuery": "better query",
  "strategy": "similarity|hybrid|mmr",
  "reasoning": "why this would be better"
}`;

  try {
    await config.llmProvider.generateStructured<{
      improvedQuery: string;
      strategy: string;
      reasoning: string;
    }>(prompt, {});

    // Return null to indicate we should re-query with improvements
    // The calling code would need to handle this
    return null;
  } catch {
    return null;
  }
}

/**
 * Get reflection metadata
 */
export function getReflections(target: object, propertyKey: string | symbol): ReflectionResult[] {
  return Reflect.getMetadata(REFLECTION_METADATA_KEY, target, propertyKey) || [];
}
