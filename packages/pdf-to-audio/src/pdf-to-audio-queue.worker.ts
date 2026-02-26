import fs from 'fs';
import path from 'path';
import { Injectable, Container, Inject, logger } from '@hazeljs/core';
import { Worker } from 'bullmq';
import { QueueService } from '@hazeljs/queue';
import { PdfToAudioService } from './pdf-to-audio.service';
import { PDF_TO_AUDIO_OUTPUT_DIR } from './pdf-to-audio.module';
import type { PdfToAudioOptions } from './types';

export const PDF_TO_AUDIO_QUEUE = 'pdf-to-audio';

export interface PdfToAudioJobData {
  pdfBase64: string;
  options: PdfToAudioOptions;
}

@Injectable()
export class PdfToAudioQueueWorker {
  private worker: Worker<PdfToAudioJobData, string> | null = null;

  constructor(
    private readonly queueService: QueueService,
    @Inject(PDF_TO_AUDIO_OUTPUT_DIR) private readonly outputDir: string
  ) {
    this.start();
  }

  private start(): void {
    const connection = this.queueService.getConnection();
    if (!connection) {
      logger.warn(
        'PdfToAudioQueueWorker: QueueService not configured (no Redis connection). PDF-to-audio jobs will not be processed.'
      );
      return;
    }

    // Ensure queue exists
    this.queueService.getQueue(PDF_TO_AUDIO_QUEUE);

    this.worker = new Worker<PdfToAudioJobData, string>(
      PDF_TO_AUDIO_QUEUE,
      async (job) => {
        logger.info(`PdfToAudio job ${job.id} started`);

        const container = Container.getInstance();
        const service = container.resolve(PdfToAudioService);
        if (!service) {
          throw new Error('PdfToAudioService not found in container');
        }
        const { pdfBase64, options } = job.data;
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        logger.info(
          `PdfToAudio job ${job.id}: PDF decoded (${(pdfBuffer.length / 1024).toFixed(1)} KB), starting conversion`
        );

        const audioBuffer = await service.convert(pdfBuffer, options, (completed, total, phase) => {
          void job.updateProgress({ completed, total, phase });
          if (phase) {
            logger.info(`PdfToAudio job ${job.id}: ${phase}`);
          } else {
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const everyN = total > 20 ? 5 : total > 10 ? 3 : 1;
            const shouldLog = completed === total || completed <= 3 || completed % everyN === 0;
            if (shouldLog) {
              logger.info(`PdfToAudio job ${job.id}: ${completed}/${total} chunks (${pct}%)`);
            }
          }
        });

        const jobId = String(job.id);
        const defaultDir = path.resolve(process.cwd(), 'data/pdf-to-audio');
        const rawDir =
          this.outputDir != null && this.outputDir !== '' ? String(this.outputDir).trim() : '';
        const outputDir = rawDir || defaultDir;
        const outPath = path.join(outputDir, `${jobId}.mp3`);
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outPath, audioBuffer);
        logger.info(`PdfToAudio job ${job.id} completed, saved to ${outPath}`);
        return outPath;
      },
      {
        connection: connection as Record<string, unknown>,
        concurrency: 1,
        lockDuration: 30 * 60 * 1000, // 30 min - job can take many minutes for large PDFs
        lockRenewTime: 30 * 1000, // renew lock every 30 sec so job doesn't stall
      }
    );

    this.worker.on('active', (job) => {
      logger.info(`PdfToAudio job ${job.id} picked up by worker`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`PdfToAudio job ${job?.id} failed:`, err);
    });

    logger.info('PdfToAudioQueueWorker started');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('PdfToAudioQueueWorker stopped');
    }
  }
}
