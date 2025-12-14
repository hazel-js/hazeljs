/**
 * Multi-Hop Decorator
 * Performs multi-hop reasoning across documents
 */

import 'reflect-metadata';
import { ReasoningChain, ReasoningHop, AgenticLLMProvider } from '../types';

export interface MultiHopConfig {
  maxHops?: number;
  strategy?: 'breadth-first' | 'depth-first' | 'adaptive';
  llmProvider?: AgenticLLMProvider;
}

const MULTIHOP_METADATA_KEY = Symbol('multiHop');

export function MultiHop(config: MultiHopConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const query = args[0] as string;
      const maxHops = config.maxHops || 3;

      const chain: ReasoningChain = {
        query,
        hops: [],
        finalAnswer: '',
        confidence: 0,
        sources: [],
      };

      let currentQuery = query;

      for (let hop = 0; hop < maxHops; hop++) {
        // Retrieve for current query
        const results = await originalMethod.apply(this, [currentQuery, ...args.slice(1)]);

        // Generate reasoning
        const reasoning = await generateReasoning(currentQuery, results, config);

        const hopResult: ReasoningHop = {
          hopNumber: hop + 1,
          query: currentQuery,
          results: Array.isArray(results) ? results : [results],
          reasoning: reasoning.reasoning,
          nextQuery: reasoning.nextQuery,
        };

        chain.hops.push(hopResult);
        chain.sources.push(...hopResult.results);

        // Check if we should continue
        if (!reasoning.nextQuery || reasoning.shouldStop) {
          break;
        }

        currentQuery = reasoning.nextQuery;
      }

      // Generate final answer
      chain.finalAnswer = await synthesizeFinalAnswer(chain, config);
      chain.confidence = calculateConfidence(chain);

      Reflect.defineMetadata(MULTIHOP_METADATA_KEY, chain, target, propertyKey);

      return chain;
    };

    return descriptor;
  };
}

async function generateReasoning(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any,
  config: MultiHopConfig
): Promise<{ reasoning: string; nextQuery?: string; shouldStop: boolean }> {
  if (!config.llmProvider) {
    return {
      reasoning: 'Retrieved results for: ' + query,
      shouldStop: true,
    };
  }

  const resultsStr = JSON.stringify(results, null, 2).slice(0, 1500);

  const prompt = `Analyze these search results and determine if we need more information.

Query: ${query}
Results: ${resultsStr}

Provide analysis in JSON:
{
  "reasoning": "what we learned from these results",
  "nextQuery": "follow-up query if needed, or null",
  "shouldStop": true/false
}`;

  try {
    return await config.llmProvider.generateStructured<{
      reasoning: string;
      nextQuery?: string;
      shouldStop: boolean;
    }>(prompt, {});
  } catch {
    return {
      reasoning: 'Retrieved results',
      shouldStop: true,
    };
  }
}

async function synthesizeFinalAnswer(
  chain: ReasoningChain,
  config: MultiHopConfig
): Promise<string> {
  if (!config.llmProvider) {
    return chain.hops.map((h) => h.reasoning).join('\n\n');
  }

  const hopsStr = chain.hops.map((h) => `Hop ${h.hopNumber}: ${h.reasoning}`).join('\n');

  const prompt = `Synthesize a final answer from this multi-hop reasoning chain:

Original Query: ${chain.query}

Reasoning Chain:
${hopsStr}

Provide a comprehensive final answer:`;

  try {
    return await config.llmProvider.generate(prompt);
  } catch {
    return hopsStr;
  }
}

function calculateConfidence(chain: ReasoningChain): number {
  const hopCount = chain.hops.length;
  const sourceCount = chain.sources.length;

  let confidence = 0.5;

  if (sourceCount >= 5) confidence += 0.2;
  if (hopCount >= 2) confidence += 0.1;
  if (chain.finalAnswer.length > 100) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

export function getReasoningChain(
  target: object,
  propertyKey: string | symbol
): ReasoningChain | undefined {
  return Reflect.getMetadata(MULTIHOP_METADATA_KEY, target, propertyKey);
}
