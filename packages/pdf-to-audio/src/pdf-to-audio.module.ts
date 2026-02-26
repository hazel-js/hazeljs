import path from 'path';
import { HazelModule } from '@hazeljs/core';
import { QueueModule } from '@hazeljs/queue';
import type { RedisConnectionOptions } from '@hazeljs/queue';
import { OpenAIProvider } from '@hazeljs/ai';
import { PdfToAudioService } from './pdf-to-audio.service';
import { PdfToAudioController } from './pdf-to-audio.controller';
import { PdfToAudioQueueWorker } from './pdf-to-audio-queue.worker';

export const PDF_TO_AUDIO_OUTPUT_DIR = 'PDF_TO_AUDIO_OUTPUT_DIR';

export interface PdfToAudioModuleOptions {
  /** Redis connection for the job queue (required for async processing) */
  connection: RedisConnectionOptions;
  /** Directory for completed audio files (default: ./data/pdf-to-audio) */
  outputDir?: string;
}

@HazelModule({
  providers: [
    {
      provide: PDF_TO_AUDIO_OUTPUT_DIR,
      useValue: path.resolve(process.cwd(), 'data/pdf-to-audio'),
    } as never,
    OpenAIProvider,
    PdfToAudioService,
    PdfToAudioQueueWorker,
  ],
  controllers: [PdfToAudioController],
})
export class PdfToAudioModule {
  /**
   * Configure PdfToAudioModule with Redis-backed queue.
   * Use this when you want async job processing (recommended).
   *
   * @example
   * ```ts
   * imports: [
   *   PdfToAudioModule.forRoot({
   *     connection: { host: 'localhost', port: 6379 },
   *   }),
   * ]
   * ```
   */
  static forRoot(options: PdfToAudioModuleOptions): {
    module: typeof PdfToAudioModule;
    imports: unknown[];
    providers: unknown[];
    controllers: unknown[];
  } {
    const outputDir = path.resolve(process.cwd(), options.outputDir ?? 'data/pdf-to-audio');
    return {
      module: PdfToAudioModule,
      imports: [QueueModule.forRoot({ connection: options.connection })],
      providers: [
        { provide: PDF_TO_AUDIO_OUTPUT_DIR, useValue: outputDir },
        OpenAIProvider,
        PdfToAudioService,
        PdfToAudioQueueWorker,
      ],
      controllers: [PdfToAudioController],
    };
  }
}
