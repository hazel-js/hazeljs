import { TimeoutMiddleware } from '../../middleware/timeout.middleware';
import { Request, Response } from '../../types';

// Mock logger
jest.mock('../../logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('TimeoutMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockReq = {
      method: 'GET',
      url: '/test',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
    };

    nextFn = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default timeout of 30 seconds', () => {
      const middleware = new TimeoutMiddleware();
      expect(middleware).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const middleware = new TimeoutMiddleware({ timeout: 5000 });
      expect(middleware).toBeDefined();
    });

    it('should accept custom message', () => {
      const middleware = new TimeoutMiddleware({ message: 'Custom timeout' });
      expect(middleware).toBeDefined();
    });
  });

  describe('handle', () => {
    it('should call next if request completes before timeout', () => {
      const middleware = new TimeoutMiddleware({ timeout: 1000 });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should send 408 response on timeout', () => {
      const middleware = new TimeoutMiddleware({ timeout: 1000 });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      jest.advanceTimersByTime(1000);

      expect(mockRes.status).toHaveBeenCalledWith(408);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 408,
        message: 'Request timeout',
        error: 'Request Timeout',
      });
    });

    it('should use custom timeout message', () => {
      const middleware = new TimeoutMiddleware({
        timeout: 1000,
        message: 'Custom timeout message',
      });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      jest.advanceTimersByTime(1000);

      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 408,
        message: 'Custom timeout message',
        error: 'Request Timeout',
      });
    });

    it('should call onTimeout callback when timeout occurs', () => {
      const onTimeoutMock = jest.fn();
      const middleware = new TimeoutMiddleware({
        timeout: 1000,
        onTimeout: onTimeoutMock,
      });

      middleware.handle(mockReq as Request, mockRes as Response, nextFn);
      jest.advanceTimersByTime(1000);

      expect(onTimeoutMock).toHaveBeenCalledWith(mockReq);
    });

    it('should handle errors in onTimeout callback gracefully', () => {
      const onTimeoutMock = jest.fn(() => {
        throw new Error('Callback error');
      });
      const middleware = new TimeoutMiddleware({
        timeout: 1000,
        onTimeout: onTimeoutMock,
      });

      middleware.handle(mockReq as Request, mockRes as Response, nextFn);
      jest.advanceTimersByTime(1000);

      // Should still send timeout response despite callback error
      expect(mockRes.status).toHaveBeenCalledWith(408);
    });

    it('should clear timeout when response ends', () => {
      const middleware = new TimeoutMiddleware({ timeout: 5000 });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      // Simulate response ending
      (mockRes.end as jest.Mock)();

      // Advance past timeout
      jest.advanceTimersByTime(6000);

      // Should not send timeout response
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should wrap res.end to clear timeout', () => {
      const originalEnd = mockRes.end;
      const middleware = new TimeoutMiddleware({ timeout: 1000 });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.end).not.toBe(originalEnd);
    });
  });

  describe('create static method', () => {
    it('should create middleware function', () => {
      const middlewareFn = TimeoutMiddleware.create({ timeout: 1000 });

      expect(typeof middlewareFn).toBe('function');
    });

    it('should create working middleware', () => {
      const middlewareFn = TimeoutMiddleware.create({ timeout: 1000 });
      middlewareFn(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should trigger timeout with created middleware', () => {
      const middlewareFn = TimeoutMiddleware.create({ timeout: 500 });
      middlewareFn(mockReq as Request, mockRes as Response, nextFn);

      jest.advanceTimersByTime(500);

      expect(mockRes.status).toHaveBeenCalledWith(408);
    });
  });
});
