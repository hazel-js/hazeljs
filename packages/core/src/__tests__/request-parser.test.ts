import { RequestParser } from '../request-parser';
import { Request } from '../types';

// Mock logger
jest.mock('../logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
}));

describe('RequestParser', () => {
  describe('parseRequest', () => {
    it('should parse basic request', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/test',
        headers: {},
        params: {},
        body: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context).toEqual({
        method: 'GET',
        url: '/test',
        headers: {},
        params: {},
        query: {},
        body: {},
      });
    });

    it('should use default method when not provided', async () => {
      const mockReq: Partial<Request> = {
        url: '/test',
        headers: {},
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.method).toBe('GET');
    });

    it('should use default url when not provided', async () => {
      const mockReq: Partial<Request> = {
        method: 'POST',
        headers: {},
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.url).toBe('/');
    });

    it('should parse query parameters', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/test?name=john&age=30',
        headers: {},
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.query).toEqual({
        name: 'john',
        age: '30',
      });
    });

    it('should parse complex query parameters', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/search?q=hello+world&filter=active&sort=desc',
        headers: {},
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.query).toEqual({
        q: 'hello world',
        filter: 'active',
        sort: 'desc',
      });
    });

    it('should handle URL without query string', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/test',
        headers: {},
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.query).toEqual({});
    });

    it('should normalize headers', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/test',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value',
        },
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.headers).toEqual({
        'content-type': 'application/json',
        'x-custom-header': 'value',
      });
    });

    it('should handle array headers', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/test',
        headers: {
          'accept': ['application/json', 'text/html'],
        } as any,
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.headers.accept).toBe('application/json, text/html');
    });

    it('should handle undefined headers', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/test',
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.headers).toEqual({});
    });

    it('should copy params from request', async () => {
      const mockReq: Partial<Request> = {
        method: 'GET',
        url: '/users/123',
        headers: {},
        params: { id: '123' },
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.params).toEqual({ id: '123' });
    });

    it('should include request body', async () => {
      const mockReq: Partial<Request> = {
        method: 'POST',
        url: '/users',
        headers: {},
        params: {},
        body: { name: 'John', email: 'john@example.com' },
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.body).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should use empty object for missing body', async () => {
      const mockReq: Partial<Request> = {
        method: 'POST',
        url: '/users',
        headers: {},
        params: {},
      };

      const context = await RequestParser.parseRequest(mockReq as Request);

      expect(context.body).toEqual({});
    });

    it('should handle parsing errors', async () => {
      const mockReq: any = {
        method: 'GET',
        url: '/test',
        headers: {},
        params: {},
        get body() {
          throw new Error('Body parsing failed');
        },
      };

      await expect(RequestParser.parseRequest(mockReq)).rejects.toThrow('Body parsing failed');
    });

    it('should handle errors with status code', async () => {
      const mockReq: any = {
        method: 'GET',
        url: '/test',
        headers: {},
        params: {},
        get body() {
          const error: any = new Error('Bad request');
          error.status = 400;
          throw error;
        },
      };

      await expect(RequestParser.parseRequest(mockReq)).rejects.toThrow('Bad request');
    });
  });
});
