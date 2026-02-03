import { SecurityHeadersMiddleware } from '../../middleware/security-headers.middleware';
import { Request, Response } from '../../types';

describe('SecurityHeadersMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
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

    nextFn = jest.fn();
  });

  describe('default options', () => {
    it('should set default security headers', () => {
      const middleware = new SecurityHeadersMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Powered-By', '');
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should set nosniff header when enabled', () => {
      const middleware = new SecurityHeadersMiddleware({ noSniff: true });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should not set nosniff header when disabled', () => {
      const middleware = new SecurityHeadersMiddleware({ noSniff: false });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });
  });

  describe('X-Frame-Options', () => {
    it('should set DENY by default', () => {
      const middleware = new SecurityHeadersMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set SAMEORIGIN when specified', () => {
      const middleware = new SecurityHeadersMiddleware({ frameOptions: 'SAMEORIGIN' });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
    });

    it('should set custom value', () => {
      const middleware = new SecurityHeadersMiddleware({ frameOptions: 'ALLOW-FROM https://example.com' });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'ALLOW-FROM https://example.com');
    });
  });

  describe('X-XSS-Protection', () => {
    it('should set XSS protection header when enabled', () => {
      const middleware = new SecurityHeadersMiddleware({ xssProtection: true });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should not set XSS protection header when disabled', () => {
      const middleware = new SecurityHeadersMiddleware({ xssProtection: false });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith('X-XSS-Protection', expect.any(String));
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    it('should set HSTS header in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = new SecurityHeadersMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age=31536000')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should set HSTS with custom max-age', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = new SecurityHeadersMiddleware({
        hsts: { maxAge: 7200 },
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age=7200')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should include includeSubDomains when specified', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = new SecurityHeadersMiddleware({
        hsts: { includeSubDomains: true },
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('includeSubDomains')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should include preload when specified', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = new SecurityHeadersMiddleware({
        hsts: { preload: true },
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('preload')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should set HSTS for HTTPS requests', () => {
      mockReq.headers = { 'x-forwarded-proto': 'https' };

      const middleware = new SecurityHeadersMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });

  describe('Content-Security-Policy', () => {
    it('should set CSP from string', () => {
      const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'";
      const middleware = new SecurityHeadersMiddleware({
        contentSecurityPolicy: csp,
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Security-Policy', csp);
    });

    it('should build CSP from object', () => {
      const middleware = new SecurityHeadersMiddleware({
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'"
      );
    });

    it('should include all CSP directives', () => {
      const middleware = new SecurityHeadersMiddleware({
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: true,
        },
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const cspCall = (mockRes.setHeader as jest.Mock).mock.calls.find(
        (call) => call[0] === 'Content-Security-Policy'
      );
      expect(cspCall).toBeDefined();
      expect(cspCall[1]).toContain('default-src');
      expect(cspCall[1]).toContain('script-src');
      expect(cspCall[1]).toContain('upgrade-insecure-requests');
    });
  });

  describe('Referrer-Policy', () => {
    it('should set referrer policy', () => {
      const middleware = new SecurityHeadersMiddleware({
        referrerPolicy: 'no-referrer',
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    });

    it('should support different referrer policies', () => {
      const policies = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
        'unsafe-url',
      ] as const;

      policies.forEach((policy) => {
        jest.clearAllMocks();
        const middleware = new SecurityHeadersMiddleware({ referrerPolicy: policy });
        middleware.use(mockReq as Request, mockRes as Response, nextFn);

        expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', policy);
      });
    });
  });

  describe('Permissions-Policy', () => {
    it('should set permissions policy', () => {
      const middleware = new SecurityHeadersMiddleware({
        permissionsPolicy: {
          geolocation: [],
          camera: ["'self'"],
        },
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        "geolocation=(), camera=('self')"
      );
    });

    it('should handle multiple permissions', () => {
      const middleware = new SecurityHeadersMiddleware({
        permissionsPolicy: {
          geolocation: [],
          microphone: [],
          camera: ["'self'"],
        },
      });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const permissionsCall = (mockRes.setHeader as jest.Mock).mock.calls.find(
        (call) => call[0] === 'Permissions-Policy'
      );
      expect(permissionsCall[1]).toContain('geolocation=()');
      expect(permissionsCall[1]).toContain('microphone=()');
      expect(permissionsCall[1]).toContain("camera=('self')");
    });
  });

  describe('X-Powered-By', () => {
    it('should hide X-Powered-By by default', () => {
      const middleware = new SecurityHeadersMiddleware();
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Powered-By', '');
    });

    it('should not hide X-Powered-By when disabled', () => {
      const middleware = new SecurityHeadersMiddleware({ hidePoweredBy: false });
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith('X-Powered-By', '');
    });
  });
});
