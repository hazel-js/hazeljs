import {
  ArgumentsHostImpl,
  Catch,
  getFilterExceptions,
} from '../../filters/exception-filter';
import { Request, Response } from '../../types';
import 'reflect-metadata';

describe('Exception Filters', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
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

  describe('ArgumentsHostImpl', () => {
    it('should create arguments host', () => {
      const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);
      expect(host).toBeDefined();
    });

    it('should switch to HTTP context', () => {
      const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);
      const http = host.switchToHttp();

      expect(http).toBeDefined();
      expect(typeof http.getRequest).toBe('function');
      expect(typeof http.getResponse).toBe('function');
    });

    it('should get request from HTTP context', () => {
      const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);
      const http = host.switchToHttp();
      const request = http.getRequest();

      expect(request).toBe(mockReq);
    });

    it('should get response from HTTP context', () => {
      const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);
      const http = host.switchToHttp();
      const response = http.getResponse();

      expect(response).toBe(mockRes);
    });

    it('should return http type', () => {
      const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);
      expect(host.getType()).toBe('http');
    });

    it('should support generic types', () => {
      const host = new ArgumentsHostImpl(mockReq as Request, mockRes as Response);
      const http = host.switchToHttp();
      
      const request = http.getRequest<Request>();
      const response = http.getResponse<Response>();

      expect(request).toBe(mockReq);
      expect(response).toBe(mockRes);
    });
  });

  describe('Catch decorator', () => {
    it('should mark class with exception metadata', () => {
      class CustomError extends Error {}

      @Catch(CustomError)
      class TestFilter {}

      const metadata = Reflect.getMetadata('hazel:exception-filter', TestFilter);
      expect(metadata).toEqual([CustomError]);
    });

    it('should support multiple exception types', () => {
      class ErrorA extends Error {}
      class ErrorB extends Error {}

      @Catch(ErrorA, ErrorB)
      class TestFilter {}

      const metadata = Reflect.getMetadata('hazel:exception-filter', TestFilter);
      expect(metadata).toEqual([ErrorA, ErrorB]);
    });

    it('should work with no exceptions', () => {
      @Catch()
      class TestFilter {}

      const metadata = Reflect.getMetadata('hazel:exception-filter', TestFilter);
      expect(metadata).toEqual([]);
    });
  });

  describe('getFilterExceptions', () => {
    it('should get exceptions from filter', () => {
      class CustomError extends Error {}

      @Catch(CustomError)
      class TestFilter {}

      const filter = new TestFilter();
      const exceptions = getFilterExceptions(filter);

      expect(exceptions).toEqual([CustomError]);
    });

    it('should return empty array if no metadata', () => {
      class TestFilter {}

      const filter = new TestFilter();
      const exceptions = getFilterExceptions(filter);

      expect(exceptions).toEqual([]);
    });

    it('should get multiple exceptions', () => {
      class ErrorA extends Error {}
      class ErrorB extends Error {}
      class ErrorC extends Error {}

      @Catch(ErrorA, ErrorB, ErrorC)
      class TestFilter {}

      const filter = new TestFilter();
      const exceptions = getFilterExceptions(filter);

      expect(exceptions).toEqual([ErrorA, ErrorB, ErrorC]);
    });
  });
});
