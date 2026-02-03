import { MiddlewareHandler, Middleware } from '../middleware';
import { Container } from '../container';
import { RequestContext } from '../types';

// Mock logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  isDebugEnabled: jest.fn().mockReturnValue(false),
}));

describe('MiddlewareHandler', () => {
  let handler: MiddlewareHandler;
  let container: Container;
  let context: RequestContext;

  beforeEach(() => {
    container = Container.createTestInstance();
    handler = new MiddlewareHandler(container);
    context = {
      method: 'GET',
      url: '/test',
      headers: {},
      params: {},
      query: {},
      body: {},
    };
  });

  describe('executeMiddlewareChain', () => {
    it('should execute final handler when no middlewares', async () => {
      const finalHandler = jest.fn().mockResolvedValue({ data: 'result' });

      const result = await handler.executeMiddlewareChain([], context, finalHandler);

      expect(finalHandler).toHaveBeenCalled();
      expect(result).toEqual({ data: 'result' });
    });

    it('should execute single middleware', async () => {
      class TestMiddleware implements Middleware {
        async use(ctx: RequestContext, next: () => Promise<unknown>) {
          return next();
        }
      }

      container.registerProvider({ token: TestMiddleware, useClass: TestMiddleware });
      const finalHandler = jest.fn().mockResolvedValue({ data: 'result' });

      const result = await handler.executeMiddlewareChain([TestMiddleware], context, finalHandler);

      expect(result).toEqual({ data: 'result' });
    });

    it('should execute multiple middlewares in order', async () => {
      const executionOrder: number[] = [];

      class Middleware1 implements Middleware {
        async use(ctx: RequestContext, next: () => Promise<unknown>) {
          executionOrder.push(1);
          const result = await next();
          executionOrder.push(4);
          return result;
        }
      }

      class Middleware2 implements Middleware {
        async use(ctx: RequestContext, next: () => Promise<unknown>) {
          executionOrder.push(2);
          const result = await next();
          executionOrder.push(3);
          return result;
        }
      }

      container.registerProvider({ token: Middleware1, useClass: Middleware1 });
      container.registerProvider({ token: Middleware2, useClass: Middleware2 });

      const finalHandler = jest.fn().mockResolvedValue({ data: 'result' });

      await handler.executeMiddlewareChain([Middleware1, Middleware2], context, finalHandler);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });

    it('should pass context through middleware chain', async () => {
      let capturedContext: RequestContext | null = null;

      class TestMiddleware implements Middleware {
        async use(ctx: RequestContext, next: () => Promise<unknown>) {
          capturedContext = ctx;
          return next();
        }
      }

      container.registerProvider({ token: TestMiddleware, useClass: TestMiddleware });
      const finalHandler = jest.fn().mockResolvedValue({});

      await handler.executeMiddlewareChain([TestMiddleware], context, finalHandler);

      expect(capturedContext).toBe(context);
    });

    it('should allow middleware to modify result', async () => {
      class TransformMiddleware implements Middleware {
        async use(ctx: RequestContext, next: () => Promise<unknown>) {
          const result = (await next()) as Record<string, unknown>;
          return { ...result, transformed: true };
        }
      }

      container.registerProvider({ token: TransformMiddleware, useClass: TransformMiddleware });
      const finalHandler = jest.fn().mockResolvedValue({ data: 'original' });

      const result = await handler.executeMiddlewareChain([TransformMiddleware], context, finalHandler);

      expect(result).toEqual({ data: 'original', transformed: true });
    });

    it('should handle middleware errors', async () => {
      class ErrorMiddleware implements Middleware {
        async use(_ctx: RequestContext, _next: () => Promise<unknown>) {
          throw new Error('Middleware error');
        }
      }

      container.registerProvider({ token: ErrorMiddleware, useClass: ErrorMiddleware });
      const finalHandler = jest.fn();

      await expect(
        handler.executeMiddlewareChain([ErrorMiddleware], context, finalHandler)
      ).rejects.toThrow('Middleware error');
    });

    it('should add status code to errors without one', async () => {
      class ErrorMiddleware implements Middleware {
        async use(_ctx: RequestContext, _next: () => Promise<unknown>) {
          const error = new Error('Test error');
          throw error;
        }
      }

      container.registerProvider({ token: ErrorMiddleware, useClass: ErrorMiddleware });
      const finalHandler = jest.fn();

      try {
        await handler.executeMiddlewareChain([ErrorMiddleware], context, finalHandler);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.status).toBe(500);
      }
    });

    it('should preserve existing status code on errors', async () => {
      class ErrorMiddleware implements Middleware {
        async use(_ctx: RequestContext, _next: () => Promise<unknown>) {
          const error: any = new Error('Test error');
          error.status = 400;
          throw error;
        }
      }

      container.registerProvider({ token: ErrorMiddleware, useClass: ErrorMiddleware });
      const finalHandler = jest.fn();

      try {
        await handler.executeMiddlewareChain([ErrorMiddleware], context, finalHandler);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it('should handle final handler errors', async () => {
      const finalHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

      await expect(handler.executeMiddlewareChain([], context, finalHandler)).rejects.toThrow(
        'Handler error'
      );
    });

    it('should add status to final handler errors', async () => {
      const finalHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

      try {
        await handler.executeMiddlewareChain([], context, finalHandler);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.status).toBe(500);
      }
    });

    it('should allow middleware to short-circuit chain', async () => {
      class ShortCircuitMiddleware implements Middleware {
        async use(_ctx: RequestContext, _next: () => Promise<unknown>) {
          return { shortCircuited: true };
        }
      }

      container.registerProvider({ token: ShortCircuitMiddleware, useClass: ShortCircuitMiddleware });
      const finalHandler = jest.fn();

      const result = await handler.executeMiddlewareChain(
        [ShortCircuitMiddleware],
        context,
        finalHandler
      );

      expect(result).toEqual({ shortCircuited: true });
      expect(finalHandler).not.toHaveBeenCalled();
    });

    it('should handle async middleware', async () => {
      class AsyncMiddleware implements Middleware {
        async use(ctx: RequestContext, next: () => Promise<unknown>) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return next();
        }
      }

      container.registerProvider({ token: AsyncMiddleware, useClass: AsyncMiddleware });
      const finalHandler = jest.fn().mockResolvedValue({ data: 'result' });

      const result = await handler.executeMiddlewareChain([AsyncMiddleware], context, finalHandler);

      expect(result).toEqual({ data: 'result' });
    });
  });
});
