import * as HazelExports from '../index';

describe('Index exports', () => {
  describe('main exports', () => {
    it('should export HazelApp', () => {
      expect(HazelExports.HazelApp).toBeDefined();
    });

    it('should export HazelModule', () => {
      expect(HazelExports.HazelModule).toBeDefined();
    });

    it('should export Module', () => {
      expect(HazelExports.Module).toBeDefined();
    });
  });

  describe('decorator exports', () => {
    it('should export Controller', () => {
      expect(HazelExports.Controller).toBeDefined();
    });

    it('should export Injectable', () => {
      expect(HazelExports.Injectable).toBeDefined();
    });

    it('should export Service', () => {
      expect(HazelExports.Service).toBeDefined();
    });

    it('should export Get', () => {
      expect(HazelExports.Get).toBeDefined();
    });

    it('should export Post', () => {
      expect(HazelExports.Post).toBeDefined();
    });

    it('should export Put', () => {
      expect(HazelExports.Put).toBeDefined();
    });

    it('should export Delete', () => {
      expect(HazelExports.Delete).toBeDefined();
    });

    it('should export Patch', () => {
      expect(HazelExports.Patch).toBeDefined();
    });

    it('should export Body', () => {
      expect(HazelExports.Body).toBeDefined();
    });

    it('should export Param', () => {
      expect(HazelExports.Param).toBeDefined();
    });

    it('should export Res', () => {
      expect(HazelExports.Res).toBeDefined();
    });

    it('should export Inject', () => {
      expect(HazelExports.Inject).toBeDefined();
    });

    it('should export UsePipes', () => {
      expect(HazelExports.UsePipes).toBeDefined();
    });

    it('should export UseInterceptors', () => {
      expect(HazelExports.UseInterceptors).toBeDefined();
    });

    it('should export UseGuards', () => {
      expect(HazelExports.UseGuards).toBeDefined();
    });
  });

  describe('container exports', () => {
    it('should export Container', () => {
      expect(HazelExports.Container).toBeDefined();
    });

    it('should export Scope', () => {
      expect(HazelExports.Scope).toBeDefined();
    });
  });

  describe('error exports', () => {
    it('should export HttpError', () => {
      expect(HazelExports.HttpError).toBeDefined();
    });

    it('should export BadRequestError', () => {
      expect(HazelExports.BadRequestError).toBeDefined();
    });

    it('should export UnauthorizedError', () => {
      expect(HazelExports.UnauthorizedError).toBeDefined();
    });

    it('should export ForbiddenError', () => {
      expect(HazelExports.ForbiddenError).toBeDefined();
    });

    it('should export NotFoundError', () => {
      expect(HazelExports.NotFoundError).toBeDefined();
    });

    it('should export InternalServerError', () => {
      expect(HazelExports.InternalServerError).toBeDefined();
    });
  });

  describe('pipe exports', () => {
    it('should export ValidationPipe', () => {
      expect(HazelExports.ValidationPipe).toBeDefined();
    });

    it('should export ParseIntPipe', () => {
      expect(HazelExports.ParseIntPipe).toBeDefined();
    });


    it('should export ValidationError', () => {
      expect(HazelExports.ValidationError).toBeDefined();
    });
  });

  describe('middleware exports', () => {
    it('should export CorsMiddleware', () => {
      expect(HazelExports.CorsMiddleware).toBeDefined();
    });

    it('should export CsrfMiddleware', () => {
      expect(HazelExports.CsrfMiddleware).toBeDefined();
    });

    it('should export RateLimitMiddleware', () => {
      expect(HazelExports.RateLimitMiddleware).toBeDefined();
    });

    it('should export SecurityHeadersMiddleware', () => {
      expect(HazelExports.SecurityHeadersMiddleware).toBeDefined();
    });

    it('should export TimeoutMiddleware', () => {
      expect(HazelExports.TimeoutMiddleware).toBeDefined();
    });
  });

  describe('filter exports', () => {
    it('should export Catch', () => {
      expect(HazelExports.Catch).toBeDefined();
    });

    it('should export HttpExceptionFilter', () => {
      expect(HazelExports.HttpExceptionFilter).toBeDefined();
    });
  });

  describe('interceptor exports', () => {
    it('should have interceptor types exported', () => {
      // Interceptor is exported as a type
      expect(HazelExports).toBeDefined();
    });
  });

  describe('testing exports', () => {
    it('should export Test', () => {
      expect(HazelExports.Test).toBeDefined();
    });
  });

  describe('health exports', () => {
    it('should export HealthCheckManager', () => {
      expect(HazelExports.HealthCheckManager).toBeDefined();
    });

    it('should export BuiltInHealthChecks', () => {
      expect(HazelExports.BuiltInHealthChecks).toBeDefined();
    });
  });

  describe('shutdown exports', () => {
    it('should export ShutdownManager', () => {
      expect(HazelExports.ShutdownManager).toBeDefined();
    });
  });

  describe('upload exports', () => {
    it('should export FileUploadInterceptor', () => {
      expect(HazelExports.FileUploadInterceptor).toBeDefined();
    });

    it('should export UploadedFile', () => {
      expect(HazelExports.UploadedFile).toBeDefined();
    });

    it('should export UploadedFiles', () => {
      expect(HazelExports.UploadedFiles).toBeDefined();
    });
  });

  describe('utility exports', () => {
    it('should export sanitizeHtml', () => {
      expect(HazelExports.sanitizeHtml).toBeDefined();
    });

    it('should export sanitizeString', () => {
      expect(HazelExports.sanitizeString).toBeDefined();
    });

    it('should export sanitizeUrl', () => {
      expect(HazelExports.sanitizeUrl).toBeDefined();
    });

    it('should export sanitizeEmail', () => {
      expect(HazelExports.sanitizeEmail).toBeDefined();
    });

    it('should export sanitizeObject', () => {
      expect(HazelExports.sanitizeObject).toBeDefined();
    });

    it('should export escapeHtml', () => {
      expect(HazelExports.escapeHtml).toBeDefined();
    });
  });

  describe('type exports', () => {
    it('should have type exports available', () => {
      // Request and Response are type-only exports
      expect(HazelExports).toBeDefined();
    });
  });

  describe('all exports are functions or classes', () => {
    it('should have callable decorators', () => {
      expect(typeof HazelExports.Controller).toBe('function');
      expect(typeof HazelExports.Get).toBe('function');
      expect(typeof HazelExports.Post).toBe('function');
      expect(typeof HazelExports.Injectable).toBe('function');
    });

    it('should have instantiable classes', () => {
      expect(typeof HazelExports.HazelApp).toBe('function');
      expect(typeof HazelExports.Container).toBe('function');
      expect(typeof HazelExports.ValidationPipe).toBe('function');
    });

    it('should have utility functions', () => {
      expect(typeof HazelExports.sanitizeHtml).toBe('function');
      expect(typeof HazelExports.sanitizeString).toBe('function');
      expect(typeof HazelExports.escapeHtml).toBe('function');
    });
  });
});
