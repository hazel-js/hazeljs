/**
 * Recursive Text Splitter
 * Splits text recursively by different separators
 */

import { TextSplitter, Document } from '../types';

export interface RecursiveTextSplitterConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export class RecursiveTextSplitter implements TextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(config: RecursiveTextSplitterConfig = {}) {
    this.chunkSize = config.chunkSize || 1000;
    this.chunkOverlap = config.chunkOverlap || 200;
    this.separators = config.separators || ['\n\n', '\n', '. ', ' ', ''];
  }

  split(text: string): string[] {
    return this.splitTextRecursive(text, this.separators);
  }

  splitDocuments(documents: Document[]): Document[] {
    const chunks: Document[] = [];

    for (const doc of documents) {
      const textChunks = this.split(doc.content);

      for (let i = 0; i < textChunks.length; i++) {
        chunks.push({
          content: textChunks[i],
          metadata: {
            ...doc.metadata,
            chunkIndex: i,
            totalChunks: textChunks.length,
            sourceDocId: doc.id,
          },
        });
      }
    }

    return chunks;
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    // Get the first separator
    const separator = separators[0];
    let newSeparators: string[];

    if (separator === '') {
      newSeparators = [];
    } else {
      newSeparators = separators.slice(1);
    }

    // Split by separator
    const splits = separator === '' ? text.split('') : text.split(separator);

    // Merge splits into chunks
    let currentChunk = '';
    for (const split of splits) {
      const potentialChunk = currentChunk + (currentChunk ? separator : '') + split;

      if (potentialChunk.length <= this.chunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          finalChunks.push(currentChunk);
        }

        // If split is still too large and we have more separators, recurse
        if (split.length > this.chunkSize && newSeparators.length > 0) {
          const subChunks = this.splitTextRecursive(split, newSeparators);
          finalChunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = split;
        }
      }
    }

    if (currentChunk) {
      finalChunks.push(currentChunk);
    }

    // Add overlap
    return this.addOverlap(finalChunks);
  }

  private addOverlap(chunks: string[]): string[] {
    if (this.chunkOverlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const overlappedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];

      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.slice(-this.chunkOverlap);
        chunk = overlapText + chunk;
      }

      overlappedChunks.push(chunk);
    }

    return overlappedChunks;
  }
}
