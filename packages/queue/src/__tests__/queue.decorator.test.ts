import 'reflect-metadata';
import { Queue, getQueueProcessorMetadata } from '../queue.decorator';

describe('Queue decorator', () => {
  describe('@Queue', () => {
    it('should attach metadata to a method', () => {
      class TestProcessor {
        @Queue('test-queue')
        handleJob() {}
      }

      const metadata = getQueueProcessorMetadata(new TestProcessor());
      expect(metadata).toHaveLength(1);
      expect(metadata[0].queueName).toBe('test-queue');
      expect(metadata[0].methodName).toBe('handleJob');
      expect(metadata[0].options).toEqual({});
    });

    it('should attach metadata with options', () => {
      class TestProcessor {
        @Queue('emails', { name: 'welcome-handler' })
        handleWelcome() {}
      }

      const metadata = getQueueProcessorMetadata(new TestProcessor());
      expect(metadata).toHaveLength(1);
      expect(metadata[0].queueName).toBe('emails');
      expect(metadata[0].options).toEqual({ name: 'welcome-handler' });
    });

    it('should support multiple processors on the same class', () => {
      class MultiQueueProcessor {
        @Queue('emails')
        handleEmail() {}

        @Queue('orders')
        handleOrder() {}

        @Queue('notifications')
        handleNotification() {}
      }

      const metadata = getQueueProcessorMetadata(new MultiQueueProcessor());
      expect(metadata).toHaveLength(3);

      const queueNames = metadata.map((m) => m.queueName);
      expect(queueNames).toContain('emails');
      expect(queueNames).toContain('orders');
      expect(queueNames).toContain('notifications');

      const methodNames = metadata.map((m) => m.methodName);
      expect(methodNames).toContain('handleEmail');
      expect(methodNames).toContain('handleOrder');
      expect(methodNames).toContain('handleNotification');
    });

    it('should support multiple methods for the same queue', () => {
      class SameQueueProcessor {
        @Queue('emails')
        handleWelcome() {}

        @Queue('emails')
        handleReminder() {}
      }

      const metadata = getQueueProcessorMetadata(new SameQueueProcessor());
      expect(metadata).toHaveLength(2);
      expect(metadata.every((m) => m.queueName === 'emails')).toBe(true);
    });
  });

  describe('getQueueProcessorMetadata', () => {
    it('should return empty array for class without @Queue decorators', () => {
      class PlainClass {
        plainMethod() {}
      }

      const metadata = getQueueProcessorMetadata(new PlainClass());
      expect(metadata).toEqual([]);
    });

    it('should preserve target reference in metadata', () => {
      class ProcessorWithTarget {
        @Queue('test')
        handle() {}
      }
      const instance = new ProcessorWithTarget();

      const metadata = getQueueProcessorMetadata(instance);
      expect(metadata[0].target).toBeDefined();
    });
  });
});
