const mockAdd = jest.fn();
const mockGetQueue = jest.fn();
const mockSendBuffer = jest.fn();
const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnThis();

jest.mock('@hazeljs/core', () => {
  const actual = jest.requireActual('@hazeljs/core');
  const parseMultipartFn = jest.fn();
  (global as typeof globalThis & { __mockParseMultipart?: jest.Mock }).__mockParseMultipart =
    parseMultipartFn;
  return {
    ...actual,
    FileUploadInterceptor: jest.fn().mockImplementation(() => ({
      parseMultipart: parseMultipartFn,
    })),
  };
});

jest.mock('@hazeljs/queue', () => ({
  QueueService: jest.fn().mockImplementation(() => ({
    add: mockAdd,
    getQueue: mockGetQueue,
  })),
}));

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  };
});

import { PdfToAudioController } from './pdf-to-audio.controller';
import { PDF_TO_AUDIO_QUEUE } from './pdf-to-audio-queue.worker';

const getMockParseMultipart = () =>
  (global as typeof globalThis & { __mockParseMultipart: jest.Mock }).__mockParseMultipart;

describe('PdfToAudioController', () => {
  let controller: PdfToAudioController;
  let mockQueue: { getJob: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue = {
      getJob: jest.fn(),
    };
    mockGetQueue.mockReturnValue(mockQueue);
    mockAdd.mockResolvedValue({ id: 'job-123' });
    controller = new PdfToAudioController({
      add: mockAdd,
      getQueue: mockGetQueue,
    } as never);
  });

  describe('convert', () => {
    it('should add job to queue and return jobId', async () => {
      const pdfBuffer = Buffer.from('pdf-content');
      getMockParseMultipart().mockResolvedValue({
        files: [{ originalname: 'doc.pdf', buffer: pdfBuffer }],
        fields: {},
      });

      const mockRes = {
        setHeader: jest.fn(),
        status: mockStatus,
        json: mockJson,
      };

      await controller.convert({} as never, mockRes as never);

      expect(mockAdd).toHaveBeenCalledWith(
        PDF_TO_AUDIO_QUEUE,
        'convert',
        expect.objectContaining({
          pdfBase64: expect.any(String),
          options: expect.objectContaining({ includeSummary: true }),
        })
      );
      expect(mockStatus).toHaveBeenCalledWith(202);
      expect(mockJson).toHaveBeenCalledWith({ jobId: 'job-123' });
    });

    it('should pass includeSummary false when field is "false"', async () => {
      getMockParseMultipart().mockResolvedValue({
        files: [{ originalname: 'doc.pdf', buffer: Buffer.from('pdf') }],
        fields: { includeSummary: 'false' },
      });

      await controller.convert({} as never, { status: mockStatus, json: mockJson } as never);

      expect(mockAdd).toHaveBeenCalledWith(
        PDF_TO_AUDIO_QUEUE,
        'convert',
        expect.objectContaining({
          options: expect.objectContaining({ includeSummary: false }),
        })
      );
    });

    it('should pass summaryOnly true when field is "true"', async () => {
      getMockParseMultipart().mockResolvedValue({
        files: [{ originalname: 'doc.pdf', buffer: Buffer.from('pdf') }],
        fields: { summaryOnly: 'true' },
      });

      await controller.convert({} as never, { status: mockStatus, json: mockJson } as never);

      expect(mockAdd).toHaveBeenCalledWith(
        PDF_TO_AUDIO_QUEUE,
        'convert',
        expect.objectContaining({
          options: expect.objectContaining({ summaryOnly: true }),
        })
      );
    });

    it('should pass voice from fields', async () => {
      getMockParseMultipart().mockResolvedValue({
        files: [{ originalname: 'doc.pdf', buffer: Buffer.from('pdf') }],
        fields: { voice: 'nova' },
      });

      await controller.convert({} as never, { status: mockStatus, json: mockJson } as never);

      expect(mockAdd).toHaveBeenCalledWith(
        PDF_TO_AUDIO_QUEUE,
        'convert',
        expect.objectContaining({
          options: expect.objectContaining({ voice: 'nova' }),
        })
      );
    });

    it('should throw when enqueue fails (no id)', async () => {
      getMockParseMultipart().mockResolvedValue({
        files: [{ originalname: 'doc.pdf', buffer: Buffer.from('pdf') }],
        fields: {},
      });
      mockAdd.mockResolvedValue({ id: undefined });

      await expect(
        controller.convert({} as never, { status: mockStatus, json: mockJson } as never)
      ).rejects.toThrow('Failed to enqueue job');
    });

    it('should throw when no file uploaded', async () => {
      getMockParseMultipart().mockResolvedValue({ files: [], fields: {} });

      await expect(controller.convert({} as never, {} as never)).rejects.toThrow(
        'No PDF file uploaded'
      );
      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('should return job status', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('active'),
        progress: { completed: 5, total: 10 },
        failedReason: null,
      });

      const mockRes = { json: mockJson };
      await controller.status('job-123', mockRes as never);

      expect(mockGetQueue).toHaveBeenCalledWith(PDF_TO_AUDIO_QUEUE);
      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-123',
          status: 'processing',
          progress: 50,
          totalChunks: 10,
          completedChunks: 5,
          message: 'Converting chunk 5 of 10',
        })
      );
    });

    it('should throw when job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(controller.status('bad-id', { json: mockJson } as never)).rejects.toThrow(
        'Job not found or expired'
      );
    });

    it('should return extracting phase message', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('active'),
        progress: { completed: 0, total: 0, phase: 'extracting' },
        failedReason: null,
      });
      await controller.status('job-1', { json: mockJson } as never);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Extracting text from PDF...' })
      );
    });

    it('should return summarizing phase message', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('active'),
        progress: { completed: 0, total: 10, phase: 'summarizing' },
        failedReason: null,
      });
      await controller.status('job-1', { json: mockJson } as never);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Generating document summary...' })
      );
    });

    it('should return waiting message for queued job', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('waiting'),
        progress: 0,
        failedReason: null,
      });
      await controller.status('job-1', { json: mockJson } as never);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', message: 'Job queued, waiting for worker' })
      );
    });

    it('should return error for failed job', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('failed'),
        progress: {},
        failedReason: 'TTS API error',
      });
      await controller.status('job-1', { json: mockJson } as never);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          message: 'TTS API error',
          error: 'TTS API error',
        })
      );
    });

    it('should use numeric progress when progress is a number', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('active'),
        progress: 75,
        failedReason: null,
      });
      await controller.status('job-1', { json: mockJson } as never);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ progress: 75 }));
    });
  });

  describe('download', () => {
    it('should return audio when job completed', async () => {
      const audioBuffer = Buffer.from('audio-data');
      mockQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: '/data/pdf-to-audio/job-123.mp3',
      });
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(audioBuffer);

      const mockRes = { sendBuffer: mockSendBuffer };
      await controller.download('job-123', mockRes as never);

      expect(mockExistsSync).toHaveBeenCalledWith('/data/pdf-to-audio/job-123.mp3');
      expect(mockReadFileSync).toHaveBeenCalledWith('/data/pdf-to-audio/job-123.mp3');
      expect(mockSendBuffer).toHaveBeenCalledWith(audioBuffer, 'audio/mpeg');
    });

    it('should throw when audio file not found', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: '/data/pdf-to-audio/job-123.mp3',
      });
      mockExistsSync.mockReturnValue(false);

      await expect(controller.download('job-123', {} as never)).rejects.toThrow(
        'Audio file no longer available'
      );
    });

    it('should throw when job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(controller.download('bad-id', {} as never)).rejects.toThrow(
        'Job not found or expired'
      );
    });

    it('should throw when job not completed', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('processing'),
      });

      await expect(controller.download('job-123', {} as never)).rejects.toThrow(
        'Job not completed yet'
      );
    });

    it('should throw when job has no returnvalue', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: undefined,
      });

      await expect(controller.download('job-123', {} as never)).rejects.toThrow(
        'Job result not available'
      );
    });

    it('should throw when returnvalue is not a string', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: 123,
      });

      await expect(controller.download('job-123', {} as never)).rejects.toThrow(
        'Job result not available'
      );
    });
  });
});
