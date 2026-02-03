import { CorsMiddleware } from '../../middleware/cors.middleware';
import { Request, Response } from '../../types';

describe('CorsMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      headers: {
        origin: 'https://example.com',
      },
    };

    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    nextFn = jest.fn();
  });

  describe('wildcard origin', () => {
    it('should allow all origins with *', () => {
      const middleware = new CorsMiddleware({ origin: '*' });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('specific origin', () => {
    it('should allow specific origin', () => {
      const middleware = new CorsMiddleware({ origin: 'https://example.com' });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Vary', 'Origin');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should not set origin header for disallowed origin', () => {
      const middleware = new CorsMiddleware({ origin: 'https://allowed.com' });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('array of origins', () => {
    it('should allow origins in array', () => {
      const middleware = new CorsMiddleware({
        origin: ['https://example.com', 'https://test.com'],
      });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('function origin', () => {
    it('should use function to validate origin', () => {
      const middleware = new CorsMiddleware({
        origin: (origin) => origin.endsWith('.example.com'),
      });

      mockReq.headers = { origin: 'https://app.example.com' };
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://app.example.com');
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('credentials', () => {
    it('should set credentials header when enabled', () => {
      const middleware = new CorsMiddleware({ credentials: true });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });
  });

  describe('exposed headers', () => {
    it('should set exposed headers', () => {
      const middleware = new CorsMiddleware({
        exposedHeaders: ['X-Custom-Header', 'X-Another-Header'],
      });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Expose-Headers',
        'X-Custom-Header, X-Another-Header'
      );
    });
  });

  describe('preflight requests', () => {
    beforeEach(() => {
      mockReq.method = 'OPTIONS';
    });

    it('should handle preflight request', () => {
      const middleware = new CorsMiddleware();
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.any(String));
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.end).toHaveBeenCalled();
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should set allowed methods', () => {
      const middleware = new CorsMiddleware({
        methods: ['GET', 'POST'],
      });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST');
    });

    it('should set allowed headers from request', () => {
      mockReq.headers = {
        ...mockReq.headers,
        'access-control-request-headers': 'Content-Type, Authorization',
      };

      const middleware = new CorsMiddleware();
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
    });

    it('should set max age', () => {
      const middleware = new CorsMiddleware({ maxAge: 3600 });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
    });

    it('should continue if preflightContinue is true', () => {
      const middleware = new CorsMiddleware({ preflightContinue: true });
      middleware.handle(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('static create method', () => {
    it('should create middleware function', () => {
      const middlewareFn = CorsMiddleware.create({ origin: '*' });

      expect(typeof middlewareFn).toBe('function');

      middlewareFn(mockReq as Request, mockRes as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });
  });
});
