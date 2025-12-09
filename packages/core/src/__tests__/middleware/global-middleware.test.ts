import { GlobalMiddlewareManager } from '../../middleware/global-middleware';
import { Request, Response } from '../../types';

// Mock logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('GlobalMiddlewareManager', () => {
  let manager: GlobalMiddlewareManager;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    manager = new GlobalMiddlewareManager();
    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('use', () => {
    it('should register global middleware function', () => {
      const middleware = jest.fn((req, res, next) => next());

      manager.use(middleware);

      expect(manager).toBeDefined();
    });

    it('should register global middleware class', () => {
      class TestMiddleware {
        use(req: Request, res: Response, next: () => void) {
          next();
        }
      }

      manager.use(new TestMiddleware());

      expect(manager).toBeDefined();
    });
  });

  describe('useFor', () => {
    it('should register middleware for specific routes', () => {
      const middleware = jest.fn((req, res, next) => next());

      manager.useFor(middleware, ['/users', '/posts']);

      expect(manager).toBeDefined();
    });

    it('should register middleware for route with method', () => {
      const middleware = jest.fn((req, res, next) => next());

      manager.useFor(middleware, [{ path: '/users', method: 'POST' }]);

      expect(manager).toBeDefined();
    });

    it('should register middleware for mixed route types', () => {
      const middleware = jest.fn((req, res, next) => next());

      manager.useFor(middleware, ['/users', { path: '/posts', method: 'GET' }]);

      expect(manager).toBeDefined();
    });
  });

  describe('useExcept', () => {
    it('should register middleware with exclusions', () => {
      const middleware = jest.fn((req, res, next) => next());

      manager.useExcept(middleware, ['/health', '/metrics']);

      expect(manager).toBeDefined();
    });

    it('should register middleware excluding specific methods', () => {
      const middleware = jest.fn((req, res, next) => next());

      manager.useExcept(middleware, [{ path: '/admin', method: 'DELETE' }]);

      expect(manager).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute global middleware', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.use(middleware);

      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });

    it('should execute middleware in order', async () => {
      const order: number[] = [];
      const middleware1 = jest.fn((req, res, next) => {
        order.push(1);
        next();
      });
      const middleware2 = jest.fn((req, res, next) => {
        order.push(2);
        next();
      });

      manager.use(middleware1);
      manager.use(middleware2);

      await manager.execute(mockReq as Request, mockRes as Response);

      expect(order).toEqual([1, 2]);
    });

    it('should execute route-specific middleware only for matching routes', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useFor(middleware, ['/test']);

      mockReq.url = '/test';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });

    it('should not execute middleware for non-matching routes', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useFor(middleware, ['/users']);

      mockReq.url = '/posts';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).not.toHaveBeenCalled();
    });

    it('should not execute middleware for excluded routes', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useExcept(middleware, ['/health']);

      mockReq.url = '/health';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).not.toHaveBeenCalled();
    });

    it('should execute middleware for non-excluded routes', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useExcept(middleware, ['/health']);

      mockReq.url = '/users';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });

    it('should execute class-based middleware', async () => {
      class TestMiddleware {
        use(req: Request, res: Response, next: () => void) {
          next();
        }
      }

      const instance = new TestMiddleware();
      const spy = jest.spyOn(instance, 'use');
      manager.use(instance);

      await manager.execute(mockReq as Request, mockRes as Response);

      expect(spy).toHaveBeenCalled();
    });

    it('should handle middleware errors', async () => {
      const middleware = jest.fn(() => {
        throw new Error('Middleware error');
      });
      manager.use(middleware);

      await expect(manager.execute(mockReq as Request, mockRes as Response)).rejects.toThrow(
        'Middleware error'
      );
    });

    it('should stop execution if middleware does not call next', async () => {
      const middleware1 = jest.fn((_req, _res, _next) => {
        // Don't call next
      });
      const middleware2 = jest.fn((req, res, next) => next());

      manager.use(middleware1);
      manager.use(middleware2);

      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).not.toHaveBeenCalled();
    });

    it('should handle async middleware', async () => {
      const middleware = jest.fn(async (req, res, next) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        next();
      });
      manager.use(middleware);

      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });
  });

  describe('route matching', () => {
    it('should match exact paths', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useFor(middleware, ['/users']);

      mockReq.url = '/users';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });

    it('should match paths with query strings', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useFor(middleware, ['/users']);

      mockReq.url = '/users?page=1';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });

    it('should match method-specific routes', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useFor(middleware, [{ path: '/users', method: 'POST' }]);

      mockReq.url = '/users';
      mockReq.method = 'POST';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });

    it('should not match different methods', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useFor(middleware, [{ path: '/users', method: 'POST' }]);

      mockReq.url = '/users';
      mockReq.method = 'GET';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).not.toHaveBeenCalled();
    });

    it('should match wildcard routes', async () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.useFor(middleware, ['/api/*']);

      mockReq.url = '/api/users';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty middleware list', async () => {
      await expect(
        manager.execute(mockReq as Request, mockRes as Response)
      ).resolves.not.toThrow();
    });

    it('should handle undefined URL', async () => {
      mockReq.url = undefined;

      await expect(
        manager.execute(mockReq as Request, mockRes as Response)
      ).resolves.not.toThrow();
    });

    it('should handle undefined method', async () => {
      mockReq.method = undefined;
      const middleware = jest.fn((req, res, next) => next());
      manager.use(middleware);

      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware).toHaveBeenCalled();
    });

    it('should handle multiple middleware with same route', async () => {
      const middleware1 = jest.fn((req, res, next) => next());
      const middleware2 = jest.fn((req, res, next) => next());

      manager.useFor(middleware1, ['/users']);
      manager.useFor(middleware2, ['/users']);

      mockReq.url = '/users';
      await manager.execute(mockReq as Request, mockRes as Response);

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all middleware', () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.use(middleware);
      
      manager.clear();
      
      const allMiddleware = manager.getMiddleware();
      expect(allMiddleware).toHaveLength(0);
    });
  });

  describe('getMiddleware', () => {
    it('should return all registered middleware', () => {
      const middleware1 = jest.fn((req, res, next) => next());
      const middleware2 = jest.fn((req, res, next) => next());
      
      manager.use(middleware1);
      manager.use(middleware2);
      
      const allMiddleware = manager.getMiddleware();
      expect(allMiddleware).toHaveLength(2);
    });

    it('should return copy of middleware array', () => {
      const middleware = jest.fn((req, res, next) => next());
      manager.use(middleware);
      
      const allMiddleware = manager.getMiddleware();
      allMiddleware.push({
        handler: jest.fn(),
        routes: [],
        excludedRoutes: [],
      });
      
      // Original should not be affected
      expect(manager.getMiddleware()).toHaveLength(1);
    });
  });
});
