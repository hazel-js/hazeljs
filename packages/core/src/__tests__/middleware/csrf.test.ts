import { CsrfMiddleware } from '../../middleware/csrf.middleware';
import { Request, Response } from '../../types';
import { HttpError } from '../../errors/http.error';

// Mock logger
jest.mock('../../logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('CsrfMiddleware', () => {
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

    nextFn = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create middleware with default options', () => {
      const middleware = new CsrfMiddleware();
      expect(middleware).toBeDefined();
    });

    it('should accept custom options', () => {
      const middleware = new CsrfMiddleware({
        cookieName: 'custom-csrf',
        headerName: 'x-custom-csrf',
        secret: 'test-secret',
      });
      expect(middleware).toBeDefined();
    });
  });

  describe('use - GET requests', () => {
    it('should allow GET requests without token', () => {
      const middleware = new CsrfMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
    });

    it('should set CSRF cookie', () => {
      const middleware = new CsrfMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('_csrf='));
    });

    it('should generate token with signature', () => {
      const middleware = new CsrfMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls;
      const csrfTokenCall = setHeaderCalls.find((call) => call[0] === 'X-CSRF-Token');
      const token = csrfTokenCall[1];

      expect(token).toContain('.');
      expect(token.split('.').length).toBe(2);
    });
  });

  describe('use - POST requests', () => {
    beforeEach(() => {
      mockReq.method = 'POST';
    });

    it('should reject POST without token', () => {
      const middleware = new CsrfMiddleware();

      expect(() => {
        middleware.use(mockReq as Request, mockRes as Response, nextFn);
      }).toThrow(HttpError);
    });

    it('should accept POST with valid token in header', () => {
      const middleware = new CsrfMiddleware();

      // First request to get token
      mockReq.method = 'GET';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls;
      const csrfTokenCall = setHeaderCalls.find((call) => call[0] === 'X-CSRF-Token');
      const token = csrfTokenCall[1];

      // Second request with token
      jest.clearAllMocks();
      mockReq.method = 'POST';
      mockReq.headers = {
        'x-csrf-token': token,
      };

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should accept POST with valid token in body', () => {
      const middleware = new CsrfMiddleware();

      // Get token
      mockReq.method = 'GET';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls;
      const csrfTokenCall = setHeaderCalls.find((call) => call[0] === 'X-CSRF-Token');
      const token = csrfTokenCall[1];

      // POST with token in body
      jest.clearAllMocks();
      mockReq.method = 'POST';
      mockReq.body = { _csrf: token };

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should accept POST with valid token in query', () => {
      const middleware = new CsrfMiddleware();

      // Get token
      mockReq.method = 'GET';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls;
      const csrfTokenCall = setHeaderCalls.find((call) => call[0] === 'X-CSRF-Token');
      const token = csrfTokenCall[1];

      // POST with token in query
      jest.clearAllMocks();
      mockReq.method = 'POST';
      mockReq.query = { _csrf: token };

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject POST with invalid token', () => {
      const middleware = new CsrfMiddleware();

      mockReq.headers = {
        'x-csrf-token': 'invalid-token',
      };

      expect(() => {
        middleware.use(mockReq as Request, mockRes as Response, nextFn);
      }).toThrow(HttpError);
    });
  });

  describe('excluded paths', () => {
    it('should skip CSRF check for excluded paths', () => {
      const middleware = new CsrfMiddleware({
        excludePaths: ['/api/webhook'],
      });

      mockReq.method = 'POST';
      mockReq.url = '/api/webhook';

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should check CSRF for non-excluded paths', () => {
      const middleware = new CsrfMiddleware({
        excludePaths: ['/api/webhook'],
      });

      mockReq.method = 'POST';
      mockReq.url = '/api/users';

      expect(() => {
        middleware.use(mockReq as Request, mockRes as Response, nextFn);
      }).toThrow(HttpError);
    });

    it('should handle path with query string', () => {
      const middleware = new CsrfMiddleware({
        excludePaths: ['/api/webhook'],
      });

      mockReq.method = 'POST';
      mockReq.url = '/api/webhook?param=value';

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('custom methods', () => {
    it('should protect custom methods', () => {
      const middleware = new CsrfMiddleware({
        methods: ['POST', 'DELETE', 'CUSTOM'],
      });

      mockReq.method = 'CUSTOM';

      expect(() => {
        middleware.use(mockReq as Request, mockRes as Response, nextFn);
      }).toThrow(HttpError);
    });

    it('should not protect methods not in list', () => {
      const middleware = new CsrfMiddleware({
        methods: ['POST'],
      });

      mockReq.method = 'PUT';

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('cookie options', () => {
    it('should set cookie with custom options', () => {
      const middleware = new CsrfMiddleware({
        cookieOptions: {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/api',
          maxAge: 7200,
        },
      });

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls;
      const cookieCall = setHeaderCalls.find((call) => call[0] === 'Set-Cookie');
      const cookie = cookieCall[1];

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=strict');
      expect(cookie).toContain('Path=/api');
      expect(cookie).toContain('Max-Age=7200');
    });

    it('should use custom cookie name', () => {
      const middleware = new CsrfMiddleware({
        cookieName: 'custom-csrf-token',
      });

      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls;
      const cookieCall = setHeaderCalls.find((call) => call[0] === 'Set-Cookie');
      const cookie = cookieCall[1];

      expect(cookie).toContain('custom-csrf-token=');
    });
  });

  describe('session handling', () => {
    it('should use session ID from cookie', () => {
      mockReq.headers = {
        cookie: 'sessionId=abc123; other=value',
      };

      const middleware = new CsrfMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should fallback to IP+UA hash when no session', () => {
      mockReq.headers = {
        'user-agent': 'Mozilla/5.0',
      };

      const middleware = new CsrfMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('token reuse', () => {
    it('should reuse token for same session', () => {
      const middleware = new CsrfMiddleware();

      // First request
      middleware.use(mockReq as Request, mockRes as Response, nextFn);
      const token1 = (mockRes.setHeader as jest.Mock).mock.calls.find(
        (call) => call[0] === 'X-CSRF-Token'
      )[1];

      // Second request
      jest.clearAllMocks();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);
      const token2 = (mockRes.setHeader as jest.Mock).mock.calls.find(
        (call) => call[0] === 'X-CSRF-Token'
      )[1];

      expect(token1).toBe(token2);
    });
  });
});
