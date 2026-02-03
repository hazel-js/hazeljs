import 'reflect-metadata';
import { HttpExceptionFilter } from '../../filters/http-exception.filter';
import { ArgumentsHostImpl } from '../../filters/exception-filter';
import { HttpError, BadRequestError, NotFoundError } from '../../errors/http.error';
import { Request, Response } from '../../types';

// Mock logger
jest.mock('../../logger', () => ({
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
  });

  it('should catch HttpError and send response', () => {
    const error = new HttpError(400, 'Bad request');
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Bad request',
      timestamp: expect.any(String),
      path: '/test',
    });
  });

  it('should handle BadRequestError', () => {
    const error = new BadRequestError('Invalid input');
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Invalid input',
      timestamp: expect.any(String),
      path: '/test',
    });
  });

  it('should handle NotFoundError', () => {
    const error = new NotFoundError('Resource not found');
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Resource not found',
      timestamp: expect.any(String),
      path: '/test',
    });
  });

  it('should include validation errors if present', () => {
    const validationErrors = ['Field1 is required', 'Field2 is invalid'];
    const error = new HttpError(400, 'Validation failed', validationErrors);
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Validation failed',
      timestamp: expect.any(String),
      path: '/test',
      errors: validationErrors,
    });
  });

  it('should use 500 status code if not provided', () => {
    const error = new HttpError(0, 'Unknown error');
    (error as any).statusCode = undefined;
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('should use default message if not provided', () => {
    const error = new HttpError(500, '');
    (error as any).message = undefined;
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal server error',
      })
    );
  });

  it('should include timestamp in ISO format', () => {
    const error = new HttpError(400, 'Test error');
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
    const timestamp = new Date(callArgs.timestamp);
    expect(timestamp.toISOString()).toBe(callArgs.timestamp);
  });

  it('should include request path', () => {
    mockReq.url = '/api/users/123';
    const error = new HttpError(404, 'User not found');
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/users/123',
      })
    );
  });

  it('should handle POST requests', () => {
    mockReq.method = 'POST';
    mockReq.url = '/api/users';
    const error = new BadRequestError('Invalid data');
    const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);

    filter.catch(error, host);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
