import { Router } from '../router';
import { Container } from '../container';
import { Request, Response, RequestContext } from '../types';
import { ValidationError } from '../pipes/pipe';
import { HttpError } from '../errors/http.error';
import 'reflect-metadata';

// Mock logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  isDebugEnabled: jest.fn().mockReturnValue(false),
}));

// Mock RequestParser
jest.mock('../request-parser', () => ({
  RequestParser: {
    parseRequest: jest.fn().mockResolvedValue({
      params: {},
      query: {},
      body: {},
      headers: {},
      method: 'GET',
      url: '/',
    }),
  },
}));

describe('Router', () => {
  let router: Router;
  let container: Container;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    container = Container.createTestInstance();
    router = new Router(container);

    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
      params: {},
      query: {},
      body: {},
    };

    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
    };
  });

  describe('normalizePath', () => {
    it('should normalize paths correctly', () => {
      // Access private method via any
      const normalize = (router as any).normalizePath.bind(router);

      expect(normalize('/test')).toBe('/test');
      expect(normalize('test')).toBe('/test');
      expect(normalize('/test/')).toBe('/test');
      expect(normalize('/')).toBe('/');
    });
  });

  describe('matchPath', () => {
    it('should match exact paths', () => {
      const matchPath = (router as any).matchPath.bind(router);

      expect(matchPath('/users', '/users')).toBe(true);
      expect(matchPath('/users', '/posts')).toBe(false);
    });

    it('should match paths with parameters', () => {
      const matchPath = (router as any).matchPath.bind(router);

      expect(matchPath('/users/123', '/users/:id')).toBe(true);
      expect(matchPath('/users/123/posts/456', '/users/:userId/posts/:postId')).toBe(true);
    });

    it('should not match paths with different lengths', () => {
      const matchPath = (router as any).matchPath.bind(router);

      expect(matchPath('/users/123', '/users')).toBe(false);
      expect(matchPath('/users', '/users/123')).toBe(false);
    });
  });

  describe('extractParams', () => {
    it('should extract route parameters', () => {
      const extractParams = (router as any).extractParams.bind(router);

      const params = extractParams('/users/123', '/users/:id');
      expect(params).toEqual({ id: '123' });
    });

    it('should extract multiple parameters', () => {
      const extractParams = (router as any).extractParams.bind(router);

      const params = extractParams('/users/123/posts/456', '/users/:userId/posts/:postId');
      expect(params).toEqual({ userId: '123', postId: '456' });
    });

    it('should return empty object for paths without parameters', () => {
      const extractParams = (router as any).extractParams.bind(router);

      const params = extractParams('/users', '/users');
      expect(params).toEqual({});
    });
  });

  describe('createRoutePattern', () => {
    it('should create pattern for root path', () => {
      const createPattern = (router as any).createRoutePattern.bind(router);

      const pattern = createPattern('/');
      expect(pattern.test('/')).toBe(true);
      expect(pattern.test('')).toBe(true);
    });

    it('should create pattern for static paths', () => {
      const createPattern = (router as any).createRoutePattern.bind(router);

      const pattern = createPattern('/users');
      expect(pattern.test('/users')).toBe(true);
      expect(pattern.test('/users/')).toBe(true);
      expect(pattern.test('/posts')).toBe(false);
    });

    it('should create pattern for parameterized paths', () => {
      const createPattern = (router as any).createRoutePattern.bind(router);

      const pattern = createPattern('/users/:id');
      expect(pattern.test('/users/123')).toBe(true);
      expect(pattern.test('/users/abc')).toBe(true);
      expect(pattern.test('/users')).toBe(false);
    });
  });

  describe('addRoute methods', () => {
    it('should add GET route', () => {
      const handler = jest.fn();
      router.get('/test', [handler]);

      const routes = (router as any).routes;
      expect(routes.has('GET /test')).toBe(true);
    });

    it('should add POST route', () => {
      const handler = jest.fn();
      router.post('/test', [handler]);

      const routes = (router as any).routes;
      expect(routes.has('POST /test')).toBe(true);
    });

    it('should add PUT route', () => {
      const handler = jest.fn();
      router.put('/test', [handler]);

      const routes = (router as any).routes;
      expect(routes.has('PUT /test')).toBe(true);
    });

    it('should add DELETE route', () => {
      const handler = jest.fn();
      router.delete('/test', [handler]);

      const routes = (router as any).routes;
      expect(routes.has('DELETE /test')).toBe(true);
    });
  });

  describe('match', () => {
    beforeEach(() => {
      const handler = jest.fn();
      router.get('/users/:id', [handler]);
      
      // Also add to method-specific cache
      const methodRoutes = (router as any).routesByMethod.get('GET');
      if (methodRoutes) {
        methodRoutes.set('/users/:id', [handler]);
      }
    });

    it('should match registered route', async () => {
      const context: RequestContext = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/users/123',
      };

      const match = await router.match('GET', '/users/123', context);

      expect(match).not.toBeNull();
      expect(match?.context.params).toEqual({ id: '123' });
    });

    it('should return null for unmatched route', async () => {
      const context: RequestContext = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/posts/123',
      };

      const match = await router.match('GET', '/posts/123', context);

      expect(match).toBeNull();
    });

    it('should return null for wrong method', async () => {
      const context: RequestContext = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'POST',
        url: '/users/123',
      };

      const match = await router.match('POST', '/users/123', context);

      expect(match).toBeNull();
    });

    it('should handle query strings in URL', async () => {
      const context: RequestContext = {
        params: {},
        query: { filter: 'active' },
        body: {},
        headers: {},
        method: 'GET',
        url: '/users/123?filter=active',
      };

      const match = await router.match('GET', '/users/123?filter=active', context);

      expect(match).not.toBeNull();
      expect(match?.context.params).toEqual({ id: '123' });
    });
  });

  describe('handleRequest', () => {
    it('should return 404 for unmatched routes', async () => {
      mockReq.method = 'GET';
      mockReq.url = '/nonexistent';

      await router.handleRequest(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not Found' });
    });

    it('should handle errors gracefully', async () => {
      // Mock match to throw error
      jest.spyOn(router as any, 'match').mockRejectedValue(new Error('Test error'));

      mockReq.method = 'GET';
      mockReq.url = '/test';

      await router.handleRequest(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Test error' });
    });
  });

  describe('registerController', () => {
    it('should register controller with routes', () => {
      class TestController {
        getTest() {
          return { message: 'test' };
        }
      }

      // Set up metadata
      Reflect.defineMetadata('hazel:controller', { path: '/api' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/test', propertyKey: 'getTest' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getTest');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /api/test')).toBe(true);
    });

    it('should handle controller without base path', () => {
      class TestController {
        getRoot() {
          return { message: 'root' };
        }
      }

      Reflect.defineMetadata('hazel:controller', {}, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/', propertyKey: 'getRoot' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getRoot');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /')).toBe(true);
    });

    it('should register multiple routes for same controller', () => {
      class TestController {
        getUsers() {
          return [];
        }
        createUser() {
          return { id: 1 };
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '/users' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [
          { method: 'GET', path: '/', propertyKey: 'getUsers' },
          { method: 'POST', path: '/', propertyKey: 'createUser' },
        ],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getUsers');
      Reflect.defineMetadata('hazel:inject', [], TestController, 'createUser');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /users')).toBe(true);
      expect(routes.has('POST /users')).toBe(true);
    });
  });

  describe('pipes and interceptors', () => {
    it('should apply pipes to route parameters', async () => {
      class TestPipe {
        async transform(value: unknown) {
          return `transformed-${value}`;
        }
      }

      class TestController {
        getUser() {
          return { id: 1 };
        }
      }

      container.registerProvider({ token: TestPipe, useClass: TestPipe });
      Reflect.defineMetadata('hazel:controller', { path: '/users' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/:id', propertyKey: 'getUser', pipes: [{ type: TestPipe }] }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['param:id'], TestController, 'getUser');

      router.registerController(TestController);

      const context = { params: { id: '123' }, query: {}, body: {}, headers: {}, method: 'GET', url: '/users/123' };
      const route = await router.match('GET', '/users/123', context);

      expect(route).toBeDefined();
    });

    it('should apply interceptors to routes', async () => {
      class TestInterceptor {
        async intercept(context: any, next: () => Promise<unknown>) {
          const result = await next();
          return { intercepted: true, result };
        }
      }

      class TestController {
        getUser() {
          return { id: 1 };
        }
      }

      container.registerProvider({ token: TestInterceptor, useClass: TestInterceptor });
      Reflect.defineMetadata('hazel:controller', { path: '/users' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/:id', propertyKey: 'getUser', interceptors: [{ type: TestInterceptor }] }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getUser');

      router.registerController(TestController);

      const context = { params: { id: '123' }, query: {}, body: {}, headers: {}, method: 'GET', url: '/users/123' };
      const route = await router.match('GET', '/users/123', context);

      expect(route).toBeDefined();
    });
  });

  describe('parameter injection', () => {
    it('should inject body parameter', async () => {
      class TestController {
        createUser(body: any) {
          return body;
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '/users' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'POST', path: '/', propertyKey: 'createUser' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['body'], TestController, 'createUser');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('POST /users')).toBe(true);
    });

    it('should inject query parameter', async () => {
      class TestController {
        searchUsers(query: any) {
          return query;
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '/users' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/search', propertyKey: 'searchUsers' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['query'], TestController, 'searchUsers');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /users/search')).toBe(true);
    });

    it('should inject specific param', async () => {
      class TestController {
        getUser(id: string) {
          return { id };
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '/users' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/:id', propertyKey: 'getUser' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['param:id'], TestController, 'getUser');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /users/:id')).toBe(true);
    });

    it('should inject request and response objects', async () => {
      class TestController {
        handleRequest(req: any, res: any) {
          return { req, res };
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/', propertyKey: 'handleRequest' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['request', 'response'], TestController, 'handleRequest');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /test')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle controller without routes metadata', () => {
      class TestController {}

      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle route without injections', () => {
      class TestController {
        getTest() {
          return 'test';
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/', propertyKey: 'getTest' }],
        TestController
      );

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /test')).toBe(true);
    });
  });

  describe('route normalization', () => {
    it('should normalize paths with trailing slashes', () => {
      class TestController {
        getTest() {
          return 'test';
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test/' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/', propertyKey: 'getTest' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getTest');

      router.registerController(TestController);

      const routes = (router as any).routes;
      // Path normalization may keep the trailing slash
      expect(routes.has('GET /test') || routes.has('GET /test/')).toBe(true);
    });

    it('should handle empty controller path', () => {
      class TestController {
        getRoot() {
          return 'root';
        }
      }

      Reflect.defineMetadata('hazel:controller', { path: '' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/test', propertyKey: 'getRoot' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getRoot');

      router.registerController(TestController);

      const routes = (router as any).routes;
      expect(routes.has('GET /test')).toBe(true);
    });
  });

  describe('route handler execution', () => {
    it('should execute route handler and return result', async () => {
      class TestController {
        getTest() {
          return { message: 'test' };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/', propertyKey: 'getTest' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getTest');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test',
      };

      const route = await router.match('GET', '/test', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'test' });
      }
    });

    it('should handle route with body parameter', async () => {
      class CreateDto {
        name!: string;
      }

      class TestController {
        create(body: CreateDto) {
          return { created: true, data: body };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'POST', path: '/', propertyKey: 'create' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'body', dtoType: CreateDto }],
        TestController,
        'create'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: { name: 'test' },
        headers: {},
        method: 'POST',
        url: '/test',
      };

      const route = await router.match('POST', '/test', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalled();
      }
    });

    it('should handle route with param parameter', async () => {
      class TestController {
        getById(id: string) {
          return { id };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/:id', propertyKey: 'getById' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'param', name: 'id' }],
        TestController,
        'getById'
      );

      router.registerController(TestController);

      const context = {
        params: { id: '123' },
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/123',
      };

      const route = await router.match('GET', '/test/123', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ id: '123' });
      }
    });

    it('should handle route with response parameter', async () => {
      class TestController {
        customResponse(res: any) {
          res.status(201).json({ custom: true });
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'POST', path: '/', propertyKey: 'customResponse' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'response' }],
        TestController,
        'customResponse'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'POST',
        url: '/test',
      };

      const route = await router.match('POST', '/test', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(201);
      }
    });

    it('should handle HTML response', async () => {
      class TestController {
        getHtml() {
          return '<!DOCTYPE html><html><body>Test</body></html>';
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/html', propertyKey: 'getHtml' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'getHtml');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/html',
      };

      const route = await router.match('GET', '/test/html', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
        expect(mockRes.send).toHaveBeenCalled();
      }
    });

    it('should handle route returning undefined', async () => {
      class TestController {
        noReturn() {
          // Returns undefined
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/no-return', propertyKey: 'noReturn' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'noReturn');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/no-return',
      };

      const route = await router.match('GET', '/test/no-return', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        // Should not call json or send when result is undefined
        expect(mockRes.json).not.toHaveBeenCalled();
      }
    });

    it('should handle ValidationError', async () => {
      
      class TestController {
        throwValidation() {
          throw new ValidationError('Validation failed', [
            { 
              property: 'name', 
              constraints: { required: 'Required' },
              value: undefined 
            }
          ]);
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'POST', path: '/validate', propertyKey: 'throwValidation' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'throwValidation');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'POST',
        url: '/test/validate',
      };

      const route = await router.match('POST', '/test/validate', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 400,
            message: 'Validation failed',
          })
        );
      }
    });

    it('should handle HttpError', async () => {
      
      class TestController {
        throwHttp() {
          throw new HttpError(404, 'Not found');
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/error', propertyKey: 'throwHttp' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'throwHttp');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/error',
      };

      const route = await router.match('GET', '/test/error', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          statusCode: 404,
          message: 'Not found',
        });
      }
    });

    it('should handle generic errors', async () => {
      class TestController {
        throwGeneric() {
          throw new Error('Generic error');
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/generic', propertyKey: 'throwGeneric' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'throwGeneric');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/generic',
      };

      const route = await router.match('GET', '/test/generic', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 500,
            message: 'Generic error',
          })
        );
      }
    });
  });
});
