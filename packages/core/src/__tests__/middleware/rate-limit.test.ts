import { RateLimitMiddleware } from '../../middleware/rate-limit.middleware';
import { Request, Response } from '../../types';
import { HttpError } from '../../errors/http.error';

// Mock logger
jest.mock('../../logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('RateLimitMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    } as any;
    (mockReq as any).socket = { remoteAddress: '127.0.0.1' };

    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    nextFn = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create middleware with default options', () => {
      const middleware = new RateLimitMiddleware({
        max: 10,
        windowMs: 60,
      });

      expect(middleware).toBeDefined();
    });

    it('should use custom key generator', () => {
      const customKeyGen = jest.fn().mockReturnValue('custom-key');
      const middleware = new RateLimitMiddleware({
        max: 10,
        windowMs: 60,
        keyGenerator: customKeyGen,
      });

      expect(middleware).toBeDefined();
    });
  });

  describe('use', () => {
    it('should allow requests within limit', async () => {
      const middleware = new RateLimitMiddleware({
        max: 5,
        windowMs: 60,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '5');
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '4');
    });

    it('should set standard rate limit headers', async () => {
      const middleware = new RateLimitMiddleware({
        max: 10,
        windowMs: 60,
        standardHeaders: true,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '10');
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '9');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should set legacy rate limit headers', async () => {
      const middleware = new RateLimitMiddleware({
        max: 10,
        windowMs: 60,
        legacyHeaders: true,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should throw error when limit exceeded', async () => {
      const middleware = new RateLimitMiddleware({
        max: 2,
        windowMs: 60,
      });

      // Make 3 requests
      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      await expect(
        middleware.use(mockReq as Request, mockRes as Response, nextFn)
      ).rejects.toThrow(HttpError);
    });

    it('should use custom error message', async () => {
      const middleware = new RateLimitMiddleware({
        max: 1,
        windowMs: 60,
        message: 'Custom rate limit message',
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      try {
        await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).message).toBe('Custom rate limit message');
      }
    });

    it('should use custom status code', async () => {
      const middleware = new RateLimitMiddleware({
        max: 1,
        windowMs: 60,
        statusCode: 503,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      try {
        await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      } catch (error) {
        expect((error as HttpError).statusCode).toBe(503);
      }
    });

    it('should use custom key generator', async () => {
      const customKeyGen = jest.fn().mockReturnValue('user-123');
      const middleware = new RateLimitMiddleware({
        max: 5,
        windowMs: 60,
        keyGenerator: customKeyGen,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(customKeyGen).toHaveBeenCalledWith(mockReq);
    });

    it('should handle x-forwarded-for header', async () => {
      mockReq.headers = {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      };

      const middleware = new RateLimitMiddleware({
        max: 5,
        windowMs: 60,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle x-forwarded-for as array', async () => {
      mockReq.headers = {
        'x-forwarded-for': ['192.168.1.1', '10.0.0.1'] as any,
      };

      const middleware = new RateLimitMiddleware({
        max: 5,
        windowMs: 60,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reset count after window expires', async () => {
      const middleware = new RateLimitMiddleware({
        max: 2,
        windowMs: 1, // 1 second
      });

      // First request
      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      await middleware.use(mockReq as Request, mockRes as Response, nextFn);

      // Advance time past window
      jest.advanceTimersByTime(2000);

      // Should allow new requests
      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(3);
    });

    it('should show remaining count decreasing', async () => {
      const middleware = new RateLimitMiddleware({
        max: 3,
        windowMs: 60,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '2');

      jest.clearAllMocks();
      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '1');

      jest.clearAllMocks();
      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '0');
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const middleware = new RateLimitMiddleware({
        max: 10,
        windowMs: 60,
      });

      middleware.destroy();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing socket', async () => {
      const middleware = new RateLimitMiddleware({
        max: 10,
        windowMs: 60,
      });

      const reqWithoutSocket = {
        method: 'GET',
        url: '/test',
        headers: {},
      } as Request;

      await middleware.use(reqWithoutSocket, mockRes as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle missing remote address', async () => {
      const middleware = new RateLimitMiddleware({
        max: 10,
        windowMs: 60,
      });

      const reqWithoutAddress = {
        method: 'GET',
        url: '/test',
        headers: {},
        socket: {},
      } as any;

      await middleware.use(reqWithoutAddress, mockRes as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should use X-Forwarded-For header when available', async () => {
      const middleware = new RateLimitMiddleware({
        max: 2,
        windowMs: 60,
      });

      const reqWithForwardedFor = {
        method: 'GET',
        url: '/test',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      await middleware.use(reqWithForwardedFor, mockRes as Response, nextFn);
      await middleware.use(reqWithForwardedFor, mockRes as Response, nextFn);
      
      // Third request should be rate limited
      await expect(
        middleware.use(reqWithForwardedFor, mockRes as Response, nextFn)
      ).rejects.toThrow(HttpError);
    });

    it('should handle rate limit exceeded', async () => {
      const middleware = new RateLimitMiddleware({
        max: 1,
        windowMs: 60,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      
      // Second request should be rate limited
      await expect(
        middleware.use(mockReq as Request, mockRes as Response, nextFn)
      ).rejects.toThrow(HttpError);
    });

    it('should use custom message when provided', async () => {
      const customMessage = 'Custom rate limit message';
      const middleware = new RateLimitMiddleware({
        max: 1,
        windowMs: 60,
        message: customMessage,
      });

      await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      
      try {
        await middleware.use(mockReq as Request, mockRes as Response, nextFn);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).message).toBe(customMessage);
      }
    });
  });
});
