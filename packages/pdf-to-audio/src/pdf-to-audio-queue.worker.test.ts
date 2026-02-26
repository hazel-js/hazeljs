import { PdfToAudioQueueWorker } from './pdf-to-audio-queue.worker';

describe('PdfToAudioQueueWorker', () => {
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
});
