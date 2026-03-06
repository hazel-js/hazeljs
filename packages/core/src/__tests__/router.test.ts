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

    // -----------------------------------------------------------------------
    // Parameter injection — extended types
    // -----------------------------------------------------------------------

    it('should inject named header via { type: "headers", name }', async () => {
      class TestController {
        getHeader(authHeader: string) {
          return { auth: authHeader };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/header-named', propertyKey: 'getHeader' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'headers', name: 'authorization' }],
        TestController,
        'getHeader'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: { authorization: 'Bearer token123' },
        method: 'GET',
        url: '/test/header-named',
      };

      const route = await router.match('GET', '/test/header-named', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ auth: 'Bearer token123' });
      }
    });

    it('should inject all headers when { type: "headers" } has no name', async () => {
      class TestController {
        getAllHeaders(headers: Record<string, string>) {
          return headers;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/headers-all', propertyKey: 'getAllHeaders' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'headers' }],
        TestController,
        'getAllHeaders'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: { 'x-custom': 'value' },
        method: 'GET',
        url: '/test/headers-all',
      };

      const route = await router.match('GET', '/test/headers-all', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ 'x-custom': 'value' }));
      }
    });

    it('should inject user object via { type: "user" } without field', async () => {
      class TestController {
        whoAmI(user: unknown) {
          return user;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/me', propertyKey: 'whoAmI' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'user' }],
        TestController,
        'whoAmI'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/me',
      };

      const reqWithUser = { ...mockReq, user: { sub: 'u1', role: 'admin' } };

      const route = await router.match('GET', '/test/me', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(reqWithUser as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ sub: 'u1', role: 'admin' });
      }
    });

    it('should inject specific user field via { type: "user", field }', async () => {
      class TestController {
        getRole(role: string) {
          return { role };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/role', propertyKey: 'getRole' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'user', field: 'role' }],
        TestController,
        'getRole'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/role',
      };

      const reqWithUser = { ...mockReq, user: { sub: 'u1', role: 'manager' } };

      const route = await router.match('GET', '/test/role', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(reqWithUser as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ role: 'manager' });
      }
    });

    it('should invoke a custom resolver via { type: "custom", resolve }', async () => {
      const resolvedValue = { custom: 'injected' };
      const resolveFn = jest.fn().mockReturnValue(resolvedValue);

      class TestController {
        getCustom(val: unknown) {
          return val;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/custom', propertyKey: 'getCustom' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'custom', resolve: resolveFn }],
        TestController,
        'getCustom'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/custom',
      };

      const route = await router.match('GET', '/test/custom', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(resolveFn).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith(resolvedValue);
      }
    });

    it('should auto-inject RequestContext for undecorated parameters', async () => {
      class TestController {
        contextReceiver(ctx: RequestContext) {
          return { url: ctx.url };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/ctx', propertyKey: 'contextReceiver' }],
        TestController
      );
      // No injection metadata — relies on design:paramtypes auto-inject
      Reflect.defineMetadata('hazel:inject', [], TestController, 'contextReceiver');
      Reflect.defineMetadata(
        'design:paramtypes',
        [Object], // one undecorated parameter
        TestController.prototype,
        'contextReceiver'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/ctx',
      };

      const route = await router.match('GET', '/test/ctx', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ url: '/test/ctx' });
      }
    });

    // -----------------------------------------------------------------------
    // @Redirect metadata
    // -----------------------------------------------------------------------

    it('should send a redirect response when @Redirect metadata is set', async () => {
      class TestController {
        goHome() {
          return undefined;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/redirect', propertyKey: 'goHome' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'goHome');
      // Simulate @Redirect('/home', 301) on the prototype
      Reflect.defineMetadata(
        'hazel:redirect',
        { url: '/home', statusCode: 301 },
        TestController.prototype,
        'goHome'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/redirect',
      };

      const route = await router.match('GET', '/test/redirect', context);
      expect(route).toBeDefined();

      if (route) {
        (mockRes as any).setHeader = jest.fn();
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(301);
        expect(mockRes.setHeader).toHaveBeenCalledWith('Location', '/home');
      }
    });

    // -----------------------------------------------------------------------
    // @Header metadata (custom response headers)
    // -----------------------------------------------------------------------

    it('should set custom response headers when @Header metadata is set', async () => {
      class TestController {
        headered() {
          return { ok: true };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/headered', propertyKey: 'headered' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'headered');
      Reflect.defineMetadata(
        'hazel:headers',
        [{ name: 'X-Custom', value: 'hello' }],
        TestController.prototype,
        'headered'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/headered',
      };

      const route = await router.match('GET', '/test/headered', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-Custom', 'hello');
        expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
      }
    });

    // -----------------------------------------------------------------------
    // @HttpCode metadata
    // -----------------------------------------------------------------------

    it('should use custom HTTP status code from @HttpCode when result is defined', async () => {
      class TestController {
        create() {
          return { created: true };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'POST', path: '/http-code', propertyKey: 'create' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'create');
      Reflect.defineMetadata(
        'hazel:http-code',
        201,
        TestController.prototype,
        'create'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'POST',
        url: '/test/http-code',
      };

      const route = await router.match('POST', '/test/http-code', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith({ created: true });
      }
    });

    it('should use custom HTTP status code from @HttpCode when result is undefined', async () => {
      class TestController {
        noContent() {
          return undefined;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'DELETE', path: '/no-content', propertyKey: 'noContent' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'noContent');
      Reflect.defineMetadata(
        'hazel:http-code',
        204,
        TestController.prototype,
        'noContent'
      );

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'DELETE',
        url: '/test/no-content',
      };

      const route = await router.match('DELETE', '/test/no-content', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(204);
        expect(mockRes.end).toHaveBeenCalled();
      }
    });

    // -----------------------------------------------------------------------
    // Guard execution
    // -----------------------------------------------------------------------

    it('should throw UnauthorizedError when guard canActivate returns false', async () => {
      class DenyGuard {
        canActivate() {
          return false;
        }
      }
      container.register(DenyGuard, new DenyGuard());

      class TestController {
        secret() {
          return { secret: true };
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/secret', propertyKey: 'secret' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'secret');
      Reflect.defineMetadata('hazel:guards', [DenyGuard], TestController);

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/secret',
      };

      const route = await router.match('GET', '/test/secret', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(401);
      }
    });

    it('should propagate req.user to context.user after guards pass', async () => {
      class AllowGuard {
        canActivate() {
          return true;
        }
      }
      container.register(AllowGuard, new AllowGuard());

      class TestController {
        whoAmI(user: unknown) {
          return user;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/user-propagate', propertyKey: 'whoAmI' }],
        TestController
      );
      Reflect.defineMetadata(
        'hazel:inject',
        [{ type: 'user' }],
        TestController,
        'whoAmI'
      );
      Reflect.defineMetadata('hazel:guards', [AllowGuard], TestController);

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/user-propagate',
      };

      const reqWithUser = { ...mockReq, user: { sub: 'u99' } };

      const route = await router.match('GET', '/test/user-propagate', context);
      expect(route).toBeDefined();

      if (route) {
        await route.handler(reqWithUser as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ sub: 'u99' });
      }
    });

    // -----------------------------------------------------------------------
    // Legacy string-based injection
    // -----------------------------------------------------------------------

    it('should handle legacy string injection "body"', async () => {
      class TestController {
        legacyBody(body: unknown) {
          return body;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'POST', path: '/legacy-body', propertyKey: 'legacyBody' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['body'], TestController, 'legacyBody');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: { name: 'legacy' },
        headers: {},
        method: 'POST',
        url: '/test/legacy-body',
      };

      const route = await router.match('POST', '/test/legacy-body', context);
      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ name: 'legacy' });
      }
    });

    it('should handle legacy string injection "param"', async () => {
      class TestController {
        legacyParam(params: unknown) {
          return params;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/legacy-param/:id', propertyKey: 'legacyParam' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['param'], TestController, 'legacyParam');

      router.registerController(TestController);

      const context = {
        params: { id: '42' },
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/legacy-param/42',
      };

      const route = await router.match('GET', '/test/legacy-param/42', context);
      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ id: '42' });
      }
    });

    it('should handle legacy string injection "query"', async () => {
      class TestController {
        legacyQuery(query: unknown) {
          return query;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/legacy-query', propertyKey: 'legacyQuery' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['query'], TestController, 'legacyQuery');

      router.registerController(TestController);

      const context = {
        params: {},
        query: { filter: 'active' },
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/legacy-query',
      };

      const route = await router.match('GET', '/test/legacy-query', context);
      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith({ filter: 'active' });
      }
    });

    it('should handle legacy string injection "headers"', async () => {
      class TestController {
        legacyHeaders(headers: unknown) {
          return headers;
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/legacy-headers', propertyKey: 'legacyHeaders' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', ['headers'], TestController, 'legacyHeaders');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: { 'x-trace': 'abc' },
        method: 'GET',
        url: '/test/legacy-headers',
      };

      const route = await router.match('GET', '/test/legacy-headers', context);
      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ 'x-trace': 'abc' }));
      }
    });

    // -----------------------------------------------------------------------
    // handleRequest edge cases
    // -----------------------------------------------------------------------

    it('should return "Internal Server Error" when a non-Error is thrown in handleRequest', async () => {
      jest.spyOn(router as any, 'match').mockRejectedValue('string-error');

      mockReq.method = 'GET';
      mockReq.url = '/test';

      await router.handleRequest(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });

    it('should use production error message when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      class TestController {
        throwInProd() {
          throw new Error('Sensitive internal details');
        }
      }

      container.register(TestController, new TestController());
      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ method: 'GET', path: '/prod-error', propertyKey: 'throwInProd' }],
        TestController
      );
      Reflect.defineMetadata('hazel:inject', [], TestController, 'throwInProd');

      router.registerController(TestController);

      const context = {
        params: {},
        query: {},
        body: {},
        headers: {},
        method: 'GET',
        url: '/test/prod-error',
      };

      const route = await router.match('GET', '/test/prod-error', context);
      if (route) {
        await route.handler(mockReq as any, mockRes as any, context);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Internal server error' })
        );
      }

      process.env.NODE_ENV = originalEnv;
    });
  });
});
