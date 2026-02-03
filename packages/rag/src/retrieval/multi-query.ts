/**
 * Multi-Query Retrieval
 * Generates multiple search queries from a single question to improve retrieval
 */

import { VectorStore, SearchResult, QueryOptions } from '../types';

export interface MultiQueryConfig {
  numQueries?: number; // Number of queries to generate (default: 3)
  llmProvider?: 'openai' | 'anthropic' | 'custom';
  apiKey?: string;
  model?: string;
  customGenerator?: (question: string, numQueries: number) => Promise<string[]>;
}

export class MultiQueryRetrieval {
  private vectorStore: VectorStore;
  private config: MultiQueryConfig;

  constructor(vectorStore: VectorStore, config: MultiQueryConfig = {}) {
    this.vectorStore = vectorStore;
    this.config = {
      numQueries: config.numQueries || 3,
      llmProvider: config.llmProvider || 'openai',
      ...config,
    };
  }

  /**
   * Perform multi-query retrieval
   */
  async retrieve(question: string, options?: QueryOptions): Promise<SearchResult[]> {
    // Generate multiple queries
    const queries = await this.generateQueries(question);

    // Search with each query
    const allResults: SearchResult[] = [];
    const seenIds = new Set<string>();

    for (const query of queries) {
      const results = await this.vectorStore.search(query, options);

      // Deduplicate results
      for (const result of results) {
        if (!seenIds.has(result.id)) {
          seenIds.add(result.id);
          allResults.push(result);
        }
      }
    }

    // Re-rank by average score across queries
    const rankedResults = this.rankResults(allResults, queries);

    // Return top K
    const topK = options?.topK || 5;
    return rankedResults.slice(0, topK);
  }

  /**
   * Generate multiple search queries from a single question
   */
  private async generateQueries(question: string): Promise<string[]> {
    const numQueries = this.config.numQueries!;

    // Use custom generator if provided
    if (this.config.customGenerator) {
      return this.config.customGenerator(question, numQueries);
    }

    // Use LLM to generate queries
    if (this.config.llmProvider === 'openai') {
      return this.generateWithOpenAI(question, numQueries);
    }

    // Fallback: simple query variations
    return this.generateSimpleVariations(question, numQueries);
  }

  /**
   * Generate queries using OpenAI
   */
  private async generateWithOpenAI(question: string, numQueries: number): Promise<string[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OpenAI } = require('openai');
      const client = new OpenAI({ apiKey: this.config.apiKey });

      const prompt = `You are a helpful assistant that generates search queries. 
Given a question, generate ${numQueries} different search queries that could help find relevant information.
Each query should approach the question from a different angle.

Question: ${question}

Generate ${numQueries} search queries (one per line):`;

      const response = await client.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const content = response.choices[0].message.content || '';
      const queries = content
        .split('\n')
        .map((q: string) => q.replace(/^\d+\.\s*/, '').trim())
        .filter((q: string) => q.length > 0)
        .slice(0, numQueries);

      // Include original question
      return [question, ...queries].slice(0, numQueries + 1);
    } catch {
      // Fallback to simple variations on error
      return this.generateSimpleVariations(question, numQueries);
    }
  }

  /**
   * Generate simple query variations (fallback)
   */
  private generateSimpleVariations(question: string, numQueries: number): string[] {
    const queries = [question];

    // Add variations
    const variations = [
      `What is ${question.toLowerCase()}`,
      `Explain ${question.toLowerCase()}`,
      `How does ${question.toLowerCase()} work`,
      `${question} details`,
      `${question} information`,
    ];

    queries.push(...variations.slice(0, numQueries - 1));
    return queries.slice(0, numQueries);
  }

  /**
   * Rank results by frequency and average score
   */
  private rankResults(results: SearchResult[], queries: string[]): SearchResult[] {
    // Group results by ID and calculate average score
    const scoreMap = new Map<string, { result: SearchResult; scores: number[] }>();

    for (const result of results) {
      if (!scoreMap.has(result.id)) {
        scoreMap.set(result.id, { result, scores: [] });
      }
      scoreMap.get(result.id)!.scores.push(result.score);
    }

    // Calculate average score and frequency bonus
    const rankedResults = Array.from(scoreMap.values()).map(({ result, scores }) => {
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const frequencyBonus = scores.length / queries.length; // 0 to 1
      const finalScore = avgScore * 0.7 + frequencyBonus * 0.3;

      return {
        ...result,
        score: finalScore,
      };
    });

    // Sort by final score
    return rankedResults.sort((a, b) => b.score - a.score);
  }
}
