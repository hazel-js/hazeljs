import { Container } from '@hazeljs/core';
import { EventEmitterModule } from './event-emitter.module';
import { EventEmitterService } from './event-emitter.service';
import { OnEvent } from './on-event.decorator';

describe('EventEmitterModule', () => {
  let container: Container;
  const originalGetInstance = Container.getInstance;

  beforeEach(() => {
    container = Container.createTestInstance();
    (Container as { getInstance: () => Container }).getInstance = jest.fn(() => container);
  });

  afterEach(() => {
    (Container as { getInstance: () => Container }).getInstance = originalGetInstance;
  });

  describe('forRoot', () => {
    it('should return module config with providers and exports', () => {
      const config = EventEmitterModule.forRoot();

      expect(config.module).toBe(EventEmitterModule);
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].provide).toBe(EventEmitterService);
      expect(config.providers[0].useFactory).toBeDefined();
      expect(config.exports).toContain(EventEmitterService);
      expect(config.global).toBe(true);
    });

    it('should use isGlobal option', () => {
      const config = EventEmitterModule.forRoot({ isGlobal: false });
      expect(config.global).toBe(false);
    });

    it('should default isGlobal to true when not provided', () => {
      const config = EventEmitterModule.forRoot({});
      expect(config.global).toBe(true);
    });

    it('should pass options to EventEmitterService factory', () => {
      const config = EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: ':',
      });
      const factory = config.providers[0].useFactory as () => EventEmitterService;
      const service = factory();
      expect(service).toBeInstanceOf(EventEmitterService);
    });
  });

  describe('registerListenersFromProvider', () => {
    it('should register event listeners from provider with @OnEvent', () => {
      const mockEmit = jest.fn();
      const mockOn = jest.fn();
      const eventEmitter = {
        on: mockOn,
        emit: mockEmit,
      } as unknown as EventEmitterService;

      container.register(EventEmitterService, eventEmitter);

      class TestHandler {
        @OnEvent('order.created')
        handleOrderCreated(payload: unknown) {
          return payload;
        }
      }

      const handler = new TestHandler();
      EventEmitterModule.registerListenersFromProvider(handler);

      expect(mockOn).toHaveBeenCalledWith(
        'order.created',
        expect.any(Function),
        expect.objectContaining({ suppressErrors: true })
      );
    });

    it('should handle async listeners', () => {
      const mockOn = jest.fn();
      const eventEmitter = {
        on: mockOn,
      } as unknown as EventEmitterService;

      container.register(EventEmitterService, eventEmitter);

      class TestHandler {
        @OnEvent('async.event', { async: true })
        async handleAsync(_payload: unknown) {}
      }

      const handler = new TestHandler();
      EventEmitterModule.registerListenersFromProvider(handler);

      expect(mockOn).toHaveBeenCalledWith(
        'async.event',
        expect.any(Function),
        expect.objectContaining({ async: true })
      );
    });

    it('should call listener when event is emitted', () => {
      const eventEmitter = new EventEmitterService();
      container.register(EventEmitterService, eventEmitter);

      const handlerFn = jest.fn();
      class TestHandler {
        @OnEvent('test.event')
        handleTest(payload: unknown) {
          handlerFn(payload);
        }
      }

      const handler = new TestHandler();
      EventEmitterModule.registerListenersFromProvider(handler);

      eventEmitter.emit('test.event', { data: 'test' });

      expect(handlerFn).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should suppress errors when suppressErrors is true', () => {
      const eventEmitter = new EventEmitterService();
      container.register(EventEmitterService, eventEmitter);

      class TestHandler {
        @OnEvent('test.event')
        handleTest() {
          throw new Error('Handler error');
        }
      }

      const handler = new TestHandler();
      expect(() => {
        EventEmitterModule.registerListenersFromProvider(handler);
        eventEmitter.emit('test.event');
      }).not.toThrow();
    });

    it('should rethrow errors when suppressErrors is false', () => {
      const eventEmitter = new EventEmitterService();
      container.register(EventEmitterService, eventEmitter);

      class TestHandler {
        @OnEvent('test.event', { suppressErrors: false })
        handleTest() {
          throw new Error('Handler error');
        }
      }

      const handler = new TestHandler();
      EventEmitterModule.registerListenersFromProvider(handler);

      expect(() => eventEmitter.emit('test.event')).toThrow('Handler error');
    });

    it('should skip when method is not a function', () => {
      const mockOn = jest.fn();
      const eventEmitter = { on: mockOn } as unknown as EventEmitterService;
      container.register(EventEmitterService, eventEmitter);

      class TestHandler {
        @OnEvent('test.event')
        handleTest(_payload: unknown) {
          return _payload;
        }
      }

      const handler = new TestHandler();
      // Overwrite method with non-function to simulate missing/invalid method
      (handler as unknown as Record<string, unknown>).handleTest = 'not a function';
      EventEmitterModule.registerListenersFromProvider(handler);

      expect(mockOn).not.toHaveBeenCalled();
    });

    it('should handle provider with no @OnEvent decorators', () => {
      const mockOn = jest.fn();
      const eventEmitter = { on: mockOn } as unknown as EventEmitterService;
      container.register(EventEmitterService, eventEmitter);

      class PlainHandler {}

      EventEmitterModule.registerListenersFromProvider(new PlainHandler());

      expect(mockOn).not.toHaveBeenCalled();
    });

    it('should handle EventEmitterService not in container', () => {
      const emptyContainer = Container.createTestInstance();
      // Register EventEmitterService as undefined to simulate "not found"
      emptyContainer.register(EventEmitterService, undefined as unknown as EventEmitterService);
      (Container as { getInstance: () => Container }).getInstance = jest.fn(() => emptyContainer);

      class TestHandler {
        @OnEvent('test')
        handle() {}
      }

      expect(() => {
        EventEmitterModule.registerListenersFromProvider(new TestHandler());
      }).not.toThrow();
    });

    it('should handle errors during registration gracefully', () => {
      (Container as { getInstance: () => Container }).getInstance = jest.fn(() => {
        throw new Error('Container error');
      });

      class TestHandler {
        @OnEvent('test')
        handle() {}
      }

      expect(() => {
        EventEmitterModule.registerListenersFromProvider(new TestHandler());
      }).not.toThrow();
    });
  });

  describe('registerListenersFromProviders', () => {
    it('should register listeners from multiple provider classes', () => {
      const eventEmitter = new EventEmitterService();
      container.register(EventEmitterService, eventEmitter);

      const handler1Fn = jest.fn();
      const handler2Fn = jest.fn();

      class Handler1 {
        @OnEvent('event.1')
        handle() {
          handler1Fn();
        }
      }

      class Handler2 {
        @OnEvent('event.2')
        handle() {
          handler2Fn();
        }
      }

      container.register(Handler1, new Handler1());
      container.register(Handler2, new Handler2());

      EventEmitterModule.registerListenersFromProviders([Handler1, Handler2]);

      eventEmitter.emit('event.1');
      eventEmitter.emit('event.2');

      expect(handler1Fn).toHaveBeenCalled();
      expect(handler2Fn).toHaveBeenCalled();
    });

    it('should skip provider when resolve returns undefined', () => {
      const eventEmitter = new EventEmitterService();
      container.register(EventEmitterService, eventEmitter);

      class Handler1 {
        @OnEvent('event.1')
        handle() {}
      }

      const originalResolve = container.resolve.bind(container);
      jest.spyOn(container, 'resolve').mockImplementation((token) => {
        if (token === Handler1) return undefined as unknown;
        return originalResolve(token as Parameters<typeof container.resolve>[0]);
      });

      expect(() => {
        EventEmitterModule.registerListenersFromProviders([Handler1]);
      }).not.toThrow();
    });
  });
});
