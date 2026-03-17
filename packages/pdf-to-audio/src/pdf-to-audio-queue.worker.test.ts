const mockWorkerClose = jest.fn().mockResolvedValue(undefined);
const mockWorkerOn = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
}));

jest.mock('@hazeljs/core', () => {
  const actual = jest.requireActual('@hazeljs/core');
  return {
    ...actual,
    Container: { getInstance: jest.fn() },
    logger: {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    },
  };
});

import { PdfToAudioQueueWorker } from './pdf-to-audio-queue.worker';
import { Worker as BullMqWorker } from 'bullmq';

describe('PdfToAudioQueueWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not create worker when QueueService has no connection', () => {
    const mockQueueService = {
      getConnection: jest.fn().mockReturnValue(null),
      getQueue: jest.fn(),
    };
    const worker = new PdfToAudioQueueWorker(mockQueueService as never, '/tmp/pdf-to-audio');
    expect(mockQueueService.getConnection).toHaveBeenCalled();
    expect(mockQueueService.getQueue).not.toHaveBeenCalled();
    expect(worker).toBeDefined();
  });

  it('should call stop without error when worker was never started', async () => {
    const mockQueueService = {
      getConnection: jest.fn().mockReturnValue(null),
      getQueue: jest.fn(),
    };
    const worker = new PdfToAudioQueueWorker(mockQueueService as never, '/tmp/pdf-to-audio');
    await expect(worker.stop()).resolves.not.toThrow();
  });

  it('should create BullMQ Worker when connection exists and register event handlers', () => {
    const mockGetQueue = jest.fn().mockReturnValue({});
    const mockQueueService = {
      getConnection: jest.fn().mockReturnValue({ host: 'localhost' }),
      getQueue: mockGetQueue,
    };

    new PdfToAudioQueueWorker(mockQueueService as never, '/out');

    expect(mockGetQueue).toHaveBeenCalledWith('pdf-to-audio');
    expect(BullMqWorker).toHaveBeenCalledWith(
      'pdf-to-audio',
      expect.any(Function),
      expect.objectContaining({
        connection: { host: 'localhost' },
        concurrency: 1,
        lockDuration: 30 * 60 * 1000,
        lockRenewTime: 30 * 1000,
      })
    );
    expect(mockWorkerOn).toHaveBeenCalledWith('active', expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('should close worker on stop when worker was started', async () => {
    const mockQueueService = {
      getConnection: jest.fn().mockReturnValue({}),
      getQueue: jest.fn().mockReturnValue({}),
    };
    const workerInstance = new PdfToAudioQueueWorker(mockQueueService as never, '/out');

    await workerInstance.stop();

    expect(mockWorkerClose).toHaveBeenCalledTimes(1);
  });
});
