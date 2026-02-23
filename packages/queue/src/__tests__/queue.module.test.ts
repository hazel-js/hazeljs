import { Container } from '@hazeljs/core';
import { Queue } from '../queue.decorator';
import { QueueModule } from '../queue.module';
import { QueueService } from '../queue.service';

// Mock bullmq
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('QueueModule', () => {
  beforeEach(() => {
    Container.getInstance().clear?.();
  });

  describe('forRoot', () => {
    it('should return module config with providers and exports', () => {
      const config = QueueModule.forRoot({
        connection: { host: 'localhost', port: 6379 },
      });

      expect(config.module).toBe(QueueModule);
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].provide).toBe(QueueService);
      expect(config.providers[0].useFactory).toBeDefined();
      expect(config.exports).toContain(QueueService);
      expect(config.global).toBe(true);
    });

    it('should use isGlobal option', () => {
      const config = QueueModule.forRoot({
        connection: { host: 'localhost' },
        isGlobal: false,
      });
      expect(config.global).toBe(false);
    });

    it('should create QueueService with connection when useFactory is called', () => {
      const config = QueueModule.forRoot({
        connection: { host: 'redis.example.com', port: 6380 },
      });
      const factory = config.providers[0].useFactory as () => QueueService;
      const service = factory();
      expect(service).toBeInstanceOf(QueueService);
      // Service should be usable (connection was set)
      expect(() => service.getQueue('test')).not.toThrow();
    });
  });

  describe('getProcessorMetadata', () => {
    it('should return empty array for object without @Queue decorators', () => {
      const metadata = QueueModule.getProcessorMetadata({ foo: 'bar' });
      expect(metadata).toEqual([]);
    });

    it('should return processor metadata for class with @Queue decorators', () => {
      class TestProcessor {
        @Queue('emails')
        handleEmail() {}
      }
      const instance = new TestProcessor();
      const metadata = QueueModule.getProcessorMetadata(instance);
      expect(metadata).toHaveLength(1);
      expect(metadata[0].queueName).toBe('emails');
      expect(metadata[0].methodName).toBe('handleEmail');
      expect(metadata[0].options).toEqual({});
    });
  });

  describe('getQueueService', () => {
    it('should throw when QueueService is not in container', () => {
      // Register undefined so resolve returns undefined (container auto-resolves classes otherwise)
      Container.getInstance().register(QueueService, undefined as any);
      expect(() => QueueModule.getQueueService()).toThrow(
        'QueueService not found. Ensure QueueModule is imported.'
      );
    });

    it('should return QueueService when registered in container', () => {
      const service = new QueueService();
      service.setConnection({ host: 'localhost' });
      Container.getInstance().register(QueueService, service);

      const resolved = QueueModule.getQueueService();
      expect(resolved).toBe(service);
    });
  });
});
