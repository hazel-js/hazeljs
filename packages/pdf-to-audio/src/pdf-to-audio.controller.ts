import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Param,
  BadRequestException,
  NotFoundException,
  logger,
} from '@hazeljs/core';
import type { Request, HazelResponse } from '@hazeljs/core';
import { FileUploadInterceptor } from '@hazeljs/core';
import { QueueService } from '@hazeljs/queue';
import { PDF_TO_AUDIO_QUEUE, type PdfToAudioJobData } from './pdf-to-audio-queue.worker';
import type { PdfToAudioOptions } from './types';

const fileUpload = new FileUploadInterceptor({
  storage: 'memory',
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (file): boolean => {
    const allowed = ['application/pdf'];
    return !file.mimetype || allowed.includes(file.mimetype);
  },
});

function mapJobStateToStatus(state: string): 'pending' | 'processing' | 'completed' | 'failed' {
  switch (state) {
    case 'waiting':
    case 'delayed':
    case 'paused':
      return 'pending';
    case 'active':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

@Controller('api/pdf-to-audio')
export class PdfToAudioController {
  constructor(private readonly queueService: QueueService) {}

  @Post('/convert')
  async convert(@Req() req: Request, @Res() res: HazelResponse): Promise<void> {
    try {
      const { files, fields } = await fileUpload.parseMultipart(
        req as Parameters<typeof fileUpload.parseMultipart>[0]
      );
      const file = files?.find((f) => f.originalname?.toLowerCase().endsWith('.pdf')) || files?.[0];
      if (!file?.buffer) {
        throw new BadRequestException(
          'No PDF file uploaded. Use multipart form with field "file".'
        );
      }

      const options: PdfToAudioOptions = {
        includeSummary: fields?.includeSummary !== 'false',
        summaryOnly: fields?.summaryOnly === 'true',
        voice: fields?.voice || undefined,
      };

      const data: PdfToAudioJobData = {
        pdfBase64: file.buffer.toString('base64'),
        options,
      };

      const { id } = await this.queueService.add(PDF_TO_AUDIO_QUEUE, 'convert', data);
      if (!id) {
        throw new BadRequestException('Failed to enqueue job');
      }

      res.status(202).json({ jobId: id });
    } catch (error) {
      logger.error('PDF-to-audio job submission failed:', error);
      throw error;
    }
  }

  @Get('/status/:jobId')
  async status(@Param('jobId') jobId: string, @Res() res: HazelResponse): Promise<void> {
    const queue = this.queueService.getQueue<unknown>(PDF_TO_AUDIO_QUEUE);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found or expired');
    }

    const state = await job.getState();
    const progress = job.progress as
      | { completed?: number; total?: number; phase?: string }
      | number
      | undefined;
    const completedChunks = typeof progress === 'object' ? progress?.completed : undefined;
    const totalChunks = typeof progress === 'object' ? progress?.total : undefined;
    const phase = typeof progress === 'object' ? progress?.phase : undefined;
    const progressPct =
      typeof progress === 'number'
        ? progress
        : totalChunks && completedChunks != null && totalChunks > 0
          ? Math.round((completedChunks / totalChunks) * 100)
          : 0;

    let message: string | undefined;
    if (phase === 'extracting') {
      message = 'Extracting text from PDF...';
    } else if (phase === 'summarizing') {
      message = 'Generating document summary...';
    } else if (
      phase === 'converting' ||
      (totalChunks != null && completedChunks != null && totalChunks > 0)
    ) {
      message = `Converting chunk ${completedChunks ?? 0} of ${totalChunks ?? 0}`;
    } else if (state === 'active') {
      message = 'Processing...';
    } else if (state === 'waiting' || state === 'delayed') {
      message = 'Job queued, waiting for worker';
    } else if (state === 'completed') {
      message = 'Conversion complete';
    } else if (state === 'failed') {
      message = job.failedReason ?? 'Conversion failed';
    }

    res.json({
      jobId: job.id,
      status: mapJobStateToStatus(state),
      progress: progressPct,
      totalChunks,
      completedChunks,
      message,
      error: state === 'failed' ? (job.failedReason ?? 'Unknown error') : undefined,
    });
  }

  @Get('/download/:jobId')
  async download(@Param('jobId') jobId: string, @Res() res: HazelResponse): Promise<void> {
    const queue = this.queueService.getQueue<unknown>(PDF_TO_AUDIO_QUEUE);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found or expired');
    }

    const state = await job.getState();
    if (state !== 'completed') {
      throw new BadRequestException('Job not completed yet. Check status first.');
    }

    const filePath = (job as { returnvalue?: string }).returnvalue;
    if (!filePath || typeof filePath !== 'string') {
      throw new BadRequestException('Job result not available');
    }

    const fs = await import('fs');
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Audio file no longer available');
    }
    const audioBuffer = fs.readFileSync(filePath);
    if (res.sendBuffer) {
      res.sendBuffer(audioBuffer, 'audio/mpeg');
    }
  }
}
