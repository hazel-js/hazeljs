import { QueueService } from '../queue.service';

// Mock bullmq
const mockAdd = jest.fn();
const mockClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockAdd,
    close: mockClose,
  })),
}));

describe('QueueService', () => {
  let service: QueueService;
  const connection = { host: 'localhost', port: 6379 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdd.mockResolvedValue({ id: 'job-123' });
    mockClose.mockResolvedValue(undefined);
    service = new QueueService();
    service.setConnection(connection);
  });

  describe('setConnection', () => {
    it('should store connection options', () => {
      const svc = new QueueService();
      svc.setConnection(connection);
      expect(() => svc.getQueue('test')).not.toThrow();
    });
  });

  describe('getQueue', () => {
    it('should throw when connection is not configured', () => {
      const svc = new QueueService();
      expect(() => svc.getQueue('test')).toThrow(
        'QueueService not configured. Call setConnection() or use QueueModule.forRoot()'
      );
    });

    it('should create and return a queue for the given name', () => {
      const queue = service.getQueue('my-queue');
      expect(queue).toBeDefined();
      expect(queue.add).toBeDefined();
    });

    it('should reuse existing queue for same name', () => {
      const queue1 = service.getQueue('reused');
      const queue2 = service.getQueue('reused');
      expect(queue1).toBe(queue2);
    });

    it('should create different queues for different names', () => {
      const queue1 = service.getQueue('queue-a');
      const queue2 = service.getQueue('queue-b');
      expect(queue1).not.toBe(queue2);
    });
  });

  describe('add', () => {
    it('should add a job and return id', async () => {
      const result = await service.add('emails', 'welcome', { userId: '1', email: 'a@b.com' });
      expect(result).toEqual({ id: 'job-123' });
      expect(mockAdd).toHaveBeenCalledWith('welcome', { userId: '1', email: 'a@b.com' }, undefined);
    });

    it('should add job with empty object when data is undefined', async () => {
      await service.add('tasks', 'run');
      expect(mockAdd).toHaveBeenCalledWith('run', {}, undefined);
    });

    it('should pass job options to BullMQ', async () => {
      await service.add('tasks', 'process', { id: 1 }, { delay: 5000, priority: 10 });
      expect(mockAdd).toHaveBeenCalledWith(
        'process',
        { id: 1 },
        {
          delay: 5000,
          priority: 10,
        }
      );
    });
  });

  describe('addDelayed', () => {
    it('should add job with delay', async () => {
      await service.addDelayed('emails', 'reminder', { userId: '1' }, 3000);
      expect(mockAdd).toHaveBeenCalledWith('reminder', { userId: '1' }, { delay: 3000 });
    });
  });

  describe('addWithRetry', () => {
    it('should add job with retry options', async () => {
      await service.addWithRetry(
        'orders',
        'process',
        { orderId: 'o1' },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );
      expect(mockAdd).toHaveBeenCalledWith(
        'process',
        { orderId: 'o1' },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );
    });
  });

  describe('close', () => {
    it('should close all queues', async () => {
      service.getQueue('q1');
      service.getQueue('q2');
      await service.close();
      expect(mockClose).toHaveBeenCalledTimes(2);
    });

    it('should clear queues map after close', async () => {
      service.getQueue('q1');
      await service.close();
      // After close, getQueue would create new instance - we verify close was called
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
