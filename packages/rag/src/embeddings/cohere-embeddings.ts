/**
 * Cohere Embeddings Provider
 * High-quality embeddings with multilingual support
 */

import { EmbeddingProvider } from '../types';

// Type for Cohere client (peer dependency)
type CohereClient = any;

export interface CohereEmbeddingsConfig {
  apiKey: string;
  model?: string;
  inputType?: 'search_document' | 'search_query' | 'classification' | 'clustering';
  truncate?: 'NONE' | 'START' | 'END';
  batchSize?: number;
}

export class CohereEmbeddings implements EmbeddingProvider {
  private client: CohereClient;
  private model: string;
  private inputType: string;
  private truncate: string;
  private batchSize: number;
  private dimension: number;

  constructor(config: CohereEmbeddingsConfig) {
    const { CohereClient } = require('cohere-ai');
    this.client = new CohereClient({ token: config.apiKey });
    this.model = config.model || 'embed-english-v3.0';
    this.inputType = config.inputType || 'search_document';
    this.truncate = config.truncate || 'END';
    this.batchSize = config.batchSize || 96;
    
    // Set dimension based on model
    this.dimension = this.getModelDimension(this.model);
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embed({
        texts: [text],
        model: this.model,
        inputType: this.inputType,
        truncate: this.truncate,
      });

      return response.embeddings[0];
    } catch (error) {
      throw new Error(`Failed to generate Cohere embedding: ${error}`);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      try {
        const response = await this.client.embed({
          texts: batch,
          model: this.model,
          inputType: this.inputType,
          truncate: this.truncate,
        });

        embeddings.push(...response.embeddings);
      } catch (error) {
        throw new Error(`Failed to generate Cohere batch embeddings: ${error}`);
      }
    }

    return embeddings;
  }

  getDimension(): number {
    return this.dimension;
  }

  /**
   * Get embedding dimension for a given model
   */
  private getModelDimension(model: string): number {
    const dimensions: Record<string, number> = {
      'embed-english-v3.0': 1024,
      'embed-english-light-v3.0': 384,
      'embed-multilingual-v3.0': 1024,
      'embed-multilingual-light-v3.0': 384,
      'embed-english-v2.0': 4096,
      'embed-english-light-v2.0': 1024,
      'embed-multilingual-v2.0': 768,
    };

    return dimensions[model] || 1024;
  }

  /**
   * Create embeddings for search queries (optimized input type)
   */
  async embedQuery(query: string): Promise<number[]> {
    try {
      const response = await this.client.embed({
        texts: [query],
        model: this.model,
        inputType: 'search_query',
        truncate: this.truncate,
      });

      return response.embeddings[0];
    } catch (error) {
      throw new Error(`Failed to generate Cohere query embedding: ${error}`);
    }
  }
}
