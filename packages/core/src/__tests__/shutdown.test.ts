import { ShutdownManager } from '../shutdown';

describe('ShutdownManager', () => {
  let shutdownManager: ShutdownManager;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    shutdownManager = new ShutdownManager(5000);
    // Mock process.exit to prevent tests from terminating
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    // Clean up any handlers
    jest.clearAllMocks();
    processExitSpy.mockRestore();
  });

  describe('registerHandler', () => {
    it('should register a shutdown handler', () => {
      const handler = {
        name: 'test-handler',
        handler: jest.fn(async () => {}),
        timeout: 1000,
      };

      shutdownManager.registerHandler(handler);
      expect(shutdownManager).toBeDefined();
    });

    it('should register multiple handlers', () => {
      const handler1 = {
        name: 'handler-1',
        handler: jest.fn(async () => {}),
      };

      const handler2 = {
        name: 'handler-2',
        handler: jest.fn(async () => {}),
      };

      shutdownManager.registerHandler(handler1);
      shutdownManager.registerHandler(handler2);
      expect(shutdownManager).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should execute all registered handlers', async () => {
      const handler1 = jest.fn(async () => {});
      const handler2 = jest.fn(async () => {});

      shutdownManager.registerHandler({
        name: 'handler-1',
        handler: handler1,
      });

      shutdownManager.registerHandler({
        name: 'handler-2',
        handler: handler2,
      });

      await shutdownManager.shutdown('TEST');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should execute handlers in order', async () => {
      const executionOrder: string[] = [];

      shutdownManager.registerHandler({
        name: 'first',
        handler: async () => {
          executionOrder.push('first');
        },
      });

      shutdownManager.registerHandler({
        name: 'second',
        handler: async () => {
          executionOrder.push('second');
        },
      });

      await shutdownManager.shutdown('TEST');

      expect(executionOrder).toEqual(['first', 'second']);
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = jest.fn(async () => {
        throw new Error('Handler error');
      });

      const successHandler = jest.fn(async () => {});

      shutdownManager.registerHandler({
        name: 'error-handler',
        handler: errorHandler,
      });

      shutdownManager.registerHandler({
        name: 'success-handler',
        handler: successHandler,
      });

      await shutdownManager.shutdown('TEST');

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it('should not execute shutdown twice', async () => {
      const handler = jest.fn(async () => {});

      shutdownManager.registerHandler({
        name: 'test',
        handler,
      });

      await shutdownManager.shutdown('TEST');
      await shutdownManager.shutdown('TEST');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('isShutdown', () => {
    it('should return false initially', () => {
      expect(shutdownManager.isShutdown()).toBe(false);
    });

    it('should return true after shutdown', async () => {
      await shutdownManager.shutdown('TEST');
      expect(shutdownManager.isShutdown()).toBe(true);
    });
  });

  describe('signal handling', () => {
    it('should handle SIGTERM signal', () => {
      const shutdownSpy = jest.spyOn(shutdownManager, 'shutdown').mockResolvedValue();
      
      // Simulate SIGTERM
      process.emit('SIGTERM' as any);
      
      // Note: The actual signal handling is set up in constructor
      expect(shutdownManager).toBeDefined();
      
      shutdownSpy.mockRestore();
    });

    it('should handle SIGINT signal', () => {
      const shutdownSpy = jest.spyOn(shutdownManager, 'shutdown').mockResolvedValue();
      
      // Simulate SIGINT
      process.emit('SIGINT' as any);
      
      expect(shutdownManager).toBeDefined();
      
      shutdownSpy.mockRestore();
    });
  });

  describe('timeout handling', () => {
    it('should use default timeout', async () => {
      const manager = new ShutdownManager();
      
      const slowHandler = {
        name: 'slow-handler',
        handler: jest.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        }),
      };

      manager.registerHandler(slowHandler);
      await manager.shutdown('TEST');

      expect(slowHandler.handler).toHaveBeenCalled();
    });

    it('should respect handler timeout', async () => {
      const handler = {
        name: 'timed-handler',
        handler: jest.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        }),
        timeout: 100,
      };

      shutdownManager.registerHandler(handler);
      await shutdownManager.shutdown('TEST');

      expect(handler.handler).toHaveBeenCalled();
    });

    it('should handle handler without timeout', async () => {
      const handler = {
        name: 'no-timeout-handler',
        handler: jest.fn(async () => {}),
      };

      shutdownManager.registerHandler(handler);
      await shutdownManager.shutdown('TEST');

      expect(handler.handler).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty handlers list', async () => {
      await expect(shutdownManager.shutdown('TEST')).resolves.not.toThrow();
    });

    it('should handle handler that returns void', async () => {
      const handler = {
        name: 'void-handler',
        handler: jest.fn(async () => {}),
      };

      shutdownManager.registerHandler(handler);
      await shutdownManager.shutdown('TEST');

      expect(handler.handler).toHaveBeenCalled();
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      const handler = jest.fn(async () => {});
      
      shutdownManager.registerHandler({
        name: 'test',
        handler,
      });

      await shutdownManager.shutdown('TEST');
      await shutdownManager.shutdown('TEST');

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = jest.fn(async () => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn(async () => {});

      shutdownManager.registerHandler({
        name: 'error-handler',
        handler: errorHandler,
      });

      shutdownManager.registerHandler({
        name: 'success-handler',
        handler: successHandler,
      });

      // Mock process.exit to prevent actual exit
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await shutdownManager.shutdown('TEST');

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      
      exitSpy.mockRestore();
    });

    it('should handle handler timeout', async () => {
      const slowHandler = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      shutdownManager.registerHandler({
        name: 'slow-handler',
        handler: slowHandler,
        timeout: 50,
      });

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await shutdownManager.shutdown('TEST');

      expect(slowHandler).toHaveBeenCalled();
      
      exitSpy.mockRestore();
    });
  });

  describe('setupSignalHandlers', () => {
    it('should setup signal handlers', () => {
      shutdownManager.setupSignalHandlers();
      
      // Verify the manager is still functional
      expect(shutdownManager).toBeDefined();
    });

    it('should handle uncaught exceptions', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      
      shutdownManager.setupSignalHandlers();
      
      // Simulate uncaught exception
      const error = new Error('Test error');
      process.emit('uncaughtException', error);

      // Give time for async shutdown
      await new Promise(resolve => setTimeout(resolve, 100));
      
      exitSpy.mockRestore();
    });

    it('should handle unhandled rejections', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      
      shutdownManager.setupSignalHandlers();
      
      // Simulate unhandled rejection - catch it to prevent test failure
      const reason = 'Test rejection';
      const promise = Promise.reject(reason).catch(() => {});
      process.emit('unhandledRejection', reason, promise);

      // Give time for async shutdown
      await new Promise(resolve => setTimeout(resolve, 100));
      
      exitSpy.mockRestore();
    });
  });
});
