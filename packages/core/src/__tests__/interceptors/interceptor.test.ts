import { LoggingInterceptor, CacheInterceptor } from '../../interceptors/interceptor';
import { RequestContext } from '../../types';
import logger from '../../logger';

// Mock logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('Interceptors', () => {
  let context: RequestContext;

  beforeEach(() => {
    context = {
      method: 'GET',
      url: '/test',
      headers: {},
      params: {},
      query: {},
      body: {},
    };
    jest.clearAllMocks();
  });

  describe('LoggingInterceptor', () => {
    let interceptor: LoggingInterceptor;

    beforeEach(() => {
      interceptor = new LoggingInterceptor();
    });

    it('should log request start', async () => {
      const next = jest.fn().mockResolvedValue({ data: 'test' });

      await interceptor.intercept(context, next);

      expect(logger.info).toHaveBeenCalledWith('[GET] /test');
    });

    it('should log request completion with duration', async () => {
      const next = jest.fn().mockResolvedValue({ data: 'test' });

      await interceptor.intercept(context, next);

      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/\[GET\] \/test - \d+ms/));
    });

    it('should call next handler', async () => {
      const next = jest.fn().mockResolvedValue({ data: 'test' });

      await interceptor.intercept(context, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return result from next handler', async () => {
      const expectedResult = { data: 'test' };
      const next = jest.fn().mockResolvedValue(expectedResult);

      const result = await interceptor.intercept(context, next);

      expect(result).toBe(expectedResult);
    });

    it('should log errors with duration', async () => {
      const error = new Error('Test error');
      const next = jest.fn().mockRejectedValue(error);

      await expect(interceptor.intercept(context, next)).rejects.toThrow('Test error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[GET\] \/test - Test error \(\d+ms\)/)
      );
    });

    it('should rethrow errors', async () => {
      const error = new Error('Test error');
      const next = jest.fn().mockRejectedValue(error);

      await expect(interceptor.intercept(context, next)).rejects.toThrow(error);
    });

    it('should log POST requests', async () => {
      context.method = 'POST';
      context.url = '/api/users';
      const next = jest.fn().mockResolvedValue({ id: 1 });

      await interceptor.intercept(context, next);

      expect(logger.info).toHaveBeenCalledWith('[POST] /api/users');
    });
  });

  describe('CacheInterceptor', () => {
    let interceptor: CacheInterceptor;

    beforeEach(() => {
      interceptor = new CacheInterceptor();
      // Clear cache between tests
      (CacheInterceptor as any).cache.clear();
    });

    it('should cache GET request results', async () => {
      const next = jest.fn().mockResolvedValue({ data: 'test' });

      const result1 = await interceptor.intercept(context, next);
      const result2 = await interceptor.intercept(context, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should not cache non-GET requests', async () => {
      context.method = 'POST';
      const next = jest.fn().mockResolvedValue({ data: 'test' });

      await interceptor.intercept(context, next);
      await interceptor.intercept(context, next);

      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should use custom TTL', async () => {
      jest.useFakeTimers();
      interceptor = new CacheInterceptor({ ttl: 1000 });
      const next = jest.fn().mockResolvedValue({ data: 'test' });

      // First call - cache miss
      await interceptor.intercept(context, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second call within TTL - cache hit
      jest.advanceTimersByTime(500);
      await interceptor.intercept(context, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Third call after TTL - cache miss
      jest.advanceTimersByTime(600);
      await interceptor.intercept(context, next);
      expect(next).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should use default TTL of 60 seconds', async () => {
      jest.useFakeTimers();
      const next = jest.fn().mockResolvedValue({ data: 'test' });

      await interceptor.intercept(context, next);
      jest.advanceTimersByTime(59000);
      await interceptor.intercept(context, next);

      expect(next).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should cache different URLs separately', async () => {
      const next1 = jest.fn().mockResolvedValue({ data: 'test1' });
      const next2 = jest.fn().mockResolvedValue({ data: 'test2' });

      const context1 = { ...context, url: '/test1' };
      const context2 = { ...context, url: '/test2' };

      await interceptor.intercept(context1, next1);
      await interceptor.intercept(context2, next2);

      expect(next1).toHaveBeenCalledTimes(1);
      expect(next2).toHaveBeenCalledTimes(1);
    });

    it('should return cached data', async () => {
      const expectedData = { data: 'cached' };
      const next = jest.fn().mockResolvedValue(expectedData);

      const result1 = await interceptor.intercept(context, next);
      const result2 = await interceptor.intercept(context, next);

      expect(result1).toEqual(expectedData);
      expect(result2).toEqual(expectedData);
    });

    it('should handle PUT requests without caching', async () => {
      context.method = 'PUT';
      const next = jest.fn().mockResolvedValue({ data: 'updated' });

      await interceptor.intercept(context, next);
      await interceptor.intercept(context, next);

      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should handle DELETE requests without caching', async () => {
      context.method = 'DELETE';
      const next = jest.fn().mockResolvedValue({ success: true });

      await interceptor.intercept(context, next);
      await interceptor.intercept(context, next);

      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should cache complex objects', async () => {
      const complexData = {
        users: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ],
        meta: { total: 2, page: 1 },
      };
      const next = jest.fn().mockResolvedValue(complexData);

      const result1 = await interceptor.intercept(context, next);
      const result2 = await interceptor.intercept(context, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(complexData);
      expect(result2).toEqual(complexData);
    });
  });
});
