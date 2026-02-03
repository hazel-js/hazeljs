import {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from '../../errors/http.error';

describe('HTTP Errors', () => {
  describe('HttpError', () => {
    it('should create error with status code and message', () => {
      const error = new HttpError(418, "I'm a teapot");

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(418);
      expect(error.message).toBe("I'm a teapot");
      expect(error.name).toBe('HttpError');
    });

    it('should include validation errors', () => {
      const validationErrors = ['Field1 is required', 'Field2 is invalid'];
      const error = new HttpError(400, 'Validation failed', validationErrors);

      expect(error.errors).toEqual(validationErrors);
    });

    it('should work without validation errors', () => {
      const error = new HttpError(500, 'Server error');

      expect(error.errors).toBeUndefined();
    });
  });

  describe('BadRequestError', () => {
    it('should create 400 error', () => {
      const error = new BadRequestError('Invalid input');

      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('BadRequestError');
    });

    it('should include validation errors', () => {
      const validationErrors = ['Email is required'];
      const error = new BadRequestError('Validation failed', validationErrors);

      expect(error.errors).toEqual(validationErrors);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error with default message', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should create 401 error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error with default message', () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
      expect(error.name).toBe('ForbiddenError');
    });

    it('should create 403 error with custom message', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error with default message', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.name).toBe('NotFoundError');
    });

    it('should create 404 error with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource already exists');
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('InternalServerError', () => {
    it('should create 500 error with default message', () => {
      const error = new InternalServerError();

      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
      expect(error.name).toBe('InternalServerError');
    });

    it('should create 500 error with custom message', () => {
      const error = new InternalServerError('Database connection failed');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Database connection failed');
    });
  });

  describe('Error inheritance', () => {
    it('should be catchable as Error', () => {
      const error = new BadRequestError('test');

      expect(error instanceof Error).toBe(true);
    });

    it('should be catchable as HttpError', () => {
      const error = new NotFoundError('test');

      expect(error instanceof HttpError).toBe(true);
    });

    it('should have proper stack trace', () => {
      const error = new InternalServerError('test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('InternalServerError');
    });
  });
});
