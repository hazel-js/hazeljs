import { Injectable, logger } from '@hazeljs/core';
import { OpenAIProvider } from '@hazeljs/ai';
import { RecursiveTextSplitter } from '@hazeljs/rag';
import { extractText } from './pdf-extractor';
import type { PdfToAudioOptions } from './types';

/** Chunk size matching OpenAI TTS character limit */
const TTS_CHUNK_SIZE = 4096;

/** Max chars to send for summary (to stay within token limits) */
const SUMMARY_CONTEXT_LIMIT = 12000;

/** Ensure text chunks never exceed TTS limit (splitter can produce larger chunks) */
function enforceChunkSize(chunks: string[]): string[] {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= TTS_CHUNK_SIZE) {
      result.push(chunk);
    } else {
      for (let i = 0; i < chunk.length; i += TTS_CHUNK_SIZE) {
        result.push(chunk.slice(i, i + TTS_CHUNK_SIZE));
      }
    }
  }
  return result;
}

@Injectable()
export class PdfToAudioService {
  private splitter = new RecursiveTextSplitter({
    chunkSize: TTS_CHUNK_SIZE,
    chunkOverlap: 0,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  constructor(private readonly aiProvider: OpenAIProvider) {}

  async convert(
    pdfBuffer: Buffer,
    options?: PdfToAudioOptions,
    onProgress?: (completed: number, total: number, phase?: string) => void
  ): Promise<Buffer> {
    logger.info('PdfToAudioService.convert: extracting text');
    onProgress?.(0, 0, 'extracting');
    const text = await extractText(pdfBuffer);
    if (!text || !text.trim()) {
      throw new Error('PDF contains no extractable text');
    }

    const speech = this.aiProvider.speech?.bind(this.aiProvider);
    if (!speech) {
      throw new Error('AI provider does not support TTS (speech)');
    }

    const voice = options?.voice || 'alloy';
    const model = options?.model || 'tts-1';
    const format = options?.format || 'mp3';
    const includeSummary = options?.includeSummary !== false;
    const summaryOnly = options?.summaryOnly === true;

    const audioBuffers: Buffer[] = [];
    let completedChunks = 0;

    if (includeSummary || summaryOnly) {
      logger.info('PdfToAudioService.convert: generating summary');
      onProgress?.(0, 0, 'summarizing');
    }
    const summaryText =
      includeSummary || summaryOnly ? await this.generateSummary(text, summaryOnly) : '';
    const summaryChunks = summaryText
      ? enforceChunkSize(
          this.splitter
            .split(summaryText)
            .map((c) => c.trim())
            .filter(Boolean)
        )
      : [];
    const docChunks = summaryOnly
      ? []
      : enforceChunkSize(
          this.splitter
            .split(text)
            .map((c) => c.trim())
            .filter(Boolean)
        );
    const totalChunks = summaryChunks.length + docChunks.length;

    onProgress?.(0, totalChunks, 'converting');
    logger.info(
      `PdfToAudioService.convert: ${totalChunks} chunks to process (summaryOnly=${summaryOnly})`
    );

    if (summaryChunks.length > 0) {
      for (const chunk of summaryChunks) {
        const audioBuffer = await speech(chunk, { voice, model, format });
        audioBuffers.push(audioBuffer);
        completedChunks++;
        onProgress?.(completedChunks, totalChunks);
      }
    }
    for (const chunk of docChunks) {
      const audioBuffer = await speech(chunk, { voice, model, format });
      audioBuffers.push(audioBuffer);
      completedChunks++;
      onProgress?.(completedChunks, totalChunks);
    }

    if (audioBuffers.length === 0) {
      throw new Error('No audio chunks were generated');
    }

    return Buffer.concat(audioBuffers);
  }

  private async generateSummary(text: string, summaryOnly = false): Promise<string> {
    const context =
      text.length > SUMMARY_CONTEXT_LIMIT ? text.slice(0, SUMMARY_CONTEXT_LIMIT) + '...' : text;

    const response = await this.aiProvider.complete({
      messages: [
        {
          role: 'system',
          content:
            'You write brief document summaries for audio narration. Output 2-4 concise sentences that introduce the document. Preserve the source language—do not translate. Write in a natural, spoken style. No markdown or formatting.',
        },
        {
          role: 'user',
          content: `Summarize this document for an audio introduction. Keep the same language as the document:\n\n${context}`,
        },
      ],
      model: 'gpt-4o-mini',
      maxTokens: 150,
      temperature: 0.5,
    });

    const summary = response.content?.trim();
    if (!summary) return '';
    return summaryOnly
      ? `Document summary. ${summary}`
      : `Document summary. ${summary} Now, the full document.`;
  }
}
