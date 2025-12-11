/**
 * OpenAI Embeddings Provider
 */

import { EmbeddingProvider } from '../types';

// Type for OpenAI (optional peer dependency)
type OpenAI = any;

export interface OpenAIEmbeddingsConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
}

export class OpenAIEmbeddings implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  private dimensions: number;
  private batchSize: number;

  constructor(config: OpenAIEmbeddingsConfig) {
    const { OpenAI: OpenAIClass } = require('openai');
    this.client = new OpenAIClass({ apiKey: config.apiKey });
    this.model = config.model || 'text-embedding-3-small';
    this.dimensions = config.dimensions || 1536;
    this.batchSize = config.batchSize || 100;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: this.dimensions,
        });

        embeddings.push(...response.data.map((item: any) => item.embedding));
      } catch (error) {
        throw new Error(`Failed to generate batch embeddings: ${error}`);
      }
    }

    return embeddings;
  }

  getDimension(): number {
    return this.dimensions;
  }
}
