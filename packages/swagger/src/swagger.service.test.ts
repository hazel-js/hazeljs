import 'reflect-metadata';
import { SwaggerService } from './swagger.service';
import { Swagger, ApiOperation } from './swagger.decorator';
import { SwaggerOptions, SwaggerOperation } from './swagger.types';
import { Controller, Get, HazelModule, Patch, Post } from '@hazeljs/core';

describe('SwaggerService', () => {
  let swaggerService: SwaggerService;

  beforeEach((): void => {
    swaggerService = new SwaggerService();
  });

  const expectDefaultSchemas = (spec: ReturnType<SwaggerService['generateSpec']>): void => {
    expect(spec.components.schemas.Error).toBeDefined();
    expect(spec.components.schemas.ValidationError).toBeDefined();
  };

  describe('generateSpec', () => {
    it('should generate spec for a controller with Swagger metadata', (): void => {
      const swaggerOptions: SwaggerOptions = {
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
        tags: [{ name: 'test', description: 'Test operations' }],
      };

      const getOperation: SwaggerOperation = {
        summary: 'Get test',
        description: 'Get test description',
        tags: ['test'],
        responses: {
          '200': {
            description: 'Success',
          },
        },
      };

      const postOperation: SwaggerOperation = {
        summary: 'Create test',
        description: 'Create test description',
        tags: ['test'],
        responses: {
          '201': {
            description: 'Created',
          },
        },
      };

      @Swagger(swaggerOptions)
      @Controller({ path: '/test' })
      class TestController {
        @Get()
        @ApiOperation(getOperation)
        getTest(): void {}

        @Post()
        @ApiOperation(postOperation)
        createTest(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);

      Reflect.defineMetadata(
        'hazel:routes',
        [
          { propertyKey: 'getTest', path: '', method: 'GET' },
          { propertyKey: 'createTest', path: '', method: 'POST' },
        ],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController]);

      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toEqual({
        title: swaggerOptions.title,
        description: swaggerOptions.description,
        version: swaggerOptions.version,
      });
      expect(spec.tags).toEqual(swaggerOptions.tags);
      expect(spec.paths['/test']).toBeDefined();
      expect(spec.paths['/test'].get).toEqual({
        summary: getOperation.summary,
        description: getOperation.description,
        tags: getOperation.tags,
        responses: getOperation.responses,
      });
      expect(spec.paths['/test'].post).toEqual({
        summary: postOperation.summary,
        description: postOperation.description,
        tags: postOperation.tags,
        responses: postOperation.responses,
      });
      expectDefaultSchemas(spec);
    });

    it('should auto-generate operations for controller without Swagger metadata', (): void => {
      @Controller({ path: '/test' })
      class TestController {
        @Get()
        getTest(): void {}
      }

      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'getTest', path: '', method: 'GET' }],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController]);
      expect(spec.paths['/test']?.get).toBeDefined();
      expect(spec.paths['/test'].get.summary).toBe('Get resource(s)');
      expectDefaultSchemas(spec);
    });

    it('should handle invalid controllers', (): void => {
      class InvalidController {}
      const spec = swaggerService.generateSpec([InvalidController]);
      expect(spec).toBeDefined();
      expect(spec.paths).toEqual({});
      expectDefaultSchemas(spec);
    });

    it('should handle controller without route metadata', (): void => {
      @Swagger({
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
        tags: [{ name: 'test', description: 'Test operations' }],
      })
      @Controller({ path: '/test' })
      class TestController {
        @Get()
        @ApiOperation({
          summary: 'Get test',
          description: 'Get test description',
          tags: ['test'],
          responses: { '200': { description: 'Success' } },
        })
        getTest(): void {}
      }

      Reflect.deleteMetadata('hazel:routes', TestController);

      const spec = swaggerService.generateSpec([TestController]);
      expect(spec).toBeDefined();
      expect(spec.paths).toEqual({});
    });

    it('should auto-generate when method has no operation metadata but controller has @Swagger', (): void => {
      @Swagger({
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
        tags: [{ name: 'test', description: 'Test operations' }],
      })
      @Controller({ path: '/test' })
      class TestController {
        @Get()
        getTest(): void {}
      }

      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'getTest', path: '/test', method: 'GET' }],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController]);
      expect(spec.paths['/test/test']?.get).toBeDefined();
      expect(spec.paths['/test/test'].get.summary).toBe('Get resource(s)');
    });

    it('should skip undocumented routes when autoGenerateOperations is false', (): void => {
      @Swagger({
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
      })
      @Controller({ path: '/test' })
      class TestController {
        @Get()
        getTest(): void {}
      }

      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'getTest', path: '', method: 'GET' }],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController], {
        autoGenerateOperations: false,
      });
      expect(spec.paths).toEqual({});
    });

    it('should throw error when controllers is not an array', (): void => {
      expect(() => {
        swaggerService.generateSpec(null as never);
      }).toThrow('Controllers must be an array');
    });

    it('should handle null and undefined controllers', (): void => {
      const spec = swaggerService.generateSpec([null, undefined, {}] as never[]);
      expect(spec).toBeDefined();
      expect(spec.paths).toEqual({});
    });

    it('should handle error during spec generation', (): void => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const swaggerDecorator = require('./swagger.decorator');

      jest.spyOn(swaggerDecorator, 'getSwaggerMetadata').mockImplementation(() => {
        throw new Error('Metadata access error');
      });

      @Controller({ path: '/test' })
      class TestController {
        @Get()
        getTest(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'getTest', path: '', method: 'GET' }],
        TestController
      );

      expect(() => {
        swaggerService.generateSpec([TestController]);
      }).toThrow('Metadata access error');

      jest.restoreAllMocks();
    });

    it('should normalize paths correctly', (): void => {
      const swaggerOptions: SwaggerOptions = {
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
      };

      const getOperation: SwaggerOperation = {
        summary: 'Get test',
        responses: { '200': { description: 'Success' } },
      };

      @Swagger(swaggerOptions)
      @Controller({ path: 'test' })
      class TestController {
        @Get('path')
        @ApiOperation(getOperation)
        getTest(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: 'test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'getTest', path: 'path', method: 'GET' }],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController]);
      const pathKeys = Object.keys(spec.paths);
      expect(pathKeys.length).toBeGreaterThan(0);
      const createdPath = pathKeys[0];
      expect(createdPath.startsWith('/')).toBe(true);
      expect(spec.paths[createdPath].get).toBeDefined();
    });

    it('should handle path with trailing slash', (): void => {
      const swaggerOptions: SwaggerOptions = {
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
      };

      const getOperation: SwaggerOperation = {
        summary: 'Get test',
        responses: { '200': { description: 'Success' } },
      };

      @Swagger(swaggerOptions)
      @Controller({ path: '/test/' })
      class TestController {
        @Get()
        @ApiOperation(getOperation)
        getTest(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test/' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'getTest', path: '', method: 'GET' }],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController]);
      expect(spec.paths['/test']).toBeDefined();
    });

    it('should handle multiple controllers with same base path', (): void => {
      const swaggerOptions: SwaggerOptions = {
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
      };

      const getOperation: SwaggerOperation = {
        summary: 'Get test',
        responses: { '200': { description: 'Success' } },
      };

      const postOperation: SwaggerOperation = {
        summary: 'Post test',
        responses: { '201': { description: 'Created' } },
      };

      @Swagger(swaggerOptions)
      @Controller({ path: '/test' })
      class TestController {
        @Get()
        @ApiOperation(getOperation)
        getTest(): void {}

        @Post()
        @ApiOperation(postOperation)
        postTest(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [
          { propertyKey: 'getTest', path: '', method: 'GET' },
          { propertyKey: 'postTest', path: '', method: 'POST' },
        ],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController]);
      expect(spec.paths['/test']).toBeDefined();
      expect(spec.paths['/test'].get).toBeDefined();
      expect(spec.paths['/test'].post).toBeDefined();
    });

    it('should use controller name as tag when operation has no tags', (): void => {
      const swaggerOptions: SwaggerOptions = {
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
      };

      const getOperation: SwaggerOperation = {
        summary: 'Get test',
        responses: { '200': { description: 'Success' } },
      };

      @Swagger(swaggerOptions)
      @Controller({ path: '/test' })
      class TestController {
        @Get()
        @ApiOperation(getOperation)
        getTest(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/test' }, TestController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'getTest', path: '', method: 'GET' }],
        TestController
      );

      const spec = swaggerService.generateSpec([TestController]);
      expect(spec.paths['/test'].get.tags).toEqual(['TestController']);
    });

    it('should prepend globalPrefix to paths', (): void => {
      @Controller({ path: '/users' })
      class UserController {
        @Get()
        list(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/users' }, UserController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'list', path: '', method: 'GET' }],
        UserController
      );

      const spec = swaggerService.generateSpec([UserController], { globalPrefix: '/api' });
      expect(spec.paths['/api/users']?.get).toBeDefined();
    });

    it('should merge securitySchemes into components', (): void => {
      @Controller({ path: '/x' })
      class XController {
        @Get()
        x(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/x' }, XController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'x', path: '', method: 'GET' }],
        XController
      );

      const spec = swaggerService.generateSpec([XController], {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        security: [{ bearer: [] }],
      });

      expect(spec.components.securitySchemes?.bearer).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });
      expect(spec.security).toEqual([{ bearer: [] }]);
    });
  });

  describe('generateAutoSpec', () => {
    it('should collect controllers from module tree', (): void => {
      @Controller({ path: '/items' })
      class ItemController {
        @Get()
        list(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/items' }, ItemController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'list', path: '', method: 'GET' }],
        ItemController
      );

      @HazelModule({
        imports: [],
        controllers: [ItemController],
      })
      class AppModule {}

      const spec = swaggerService.generateAutoSpec(AppModule);
      expect(spec.paths['/items']?.get).toBeDefined();
      expectDefaultSchemas(spec);
    });

    it('should extract path parameters from route template', (): void => {
      @Controller({ path: '/users' })
      class UserController {
        @Get('/:id')
        one(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/users' }, UserController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'one', path: '/:id', method: 'GET' }],
        UserController
      );

      @HazelModule({ controllers: [UserController], imports: [] })
      class AppModule {}

      const spec = swaggerService.generateAutoSpec(AppModule);
      expect(spec.paths['/users/:id']?.get?.parameters).toEqual([
        expect.objectContaining({ name: 'id', in: 'path', required: true }),
      ]);
    });

    it('should add request body for PATCH', (): void => {
      @Controller({ path: '/users' })
      class UserController {
        @Patch('/:id')
        patch(): void {}
      }

      Reflect.defineMetadata('hazel:controller', { path: '/users' }, UserController);
      Reflect.defineMetadata(
        'hazel:routes',
        [{ propertyKey: 'patch', path: '/:id', method: 'PATCH' }],
        UserController
      );

      @HazelModule({ controllers: [UserController], imports: [] })
      class AppModule {}

      const spec = swaggerService.generateAutoSpec(AppModule);
      expect(spec.paths['/users/:id']?.patch?.requestBody).toBeDefined();
      expect(spec.paths['/users/:id'].patch.summary).toBe('Update resource');
    });
  });
});
