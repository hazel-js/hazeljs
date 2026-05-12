import { SwaggerController } from './swagger.controller';
import { SwaggerService } from './swagger.service';
import { SwaggerModule } from './swagger.module';
import { RequestContext } from '@hazeljs/core';

jest.mock('@hazeljs/core', () => {
  const actual = jest.requireActual('@hazeljs/core');
  return {
    ...actual,
    __esModule: true,
    default: {
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      http: jest.fn(),
      silly: jest.fn(),
    },
  };
});

describe('SwaggerController', () => {
  let controller: SwaggerController;
  let swaggerService: jest.Mocked<SwaggerService>;

  beforeEach(() => {
    SwaggerModule.configure({}, true);
    swaggerService = {
      generateAutoSpec: jest.fn(),
    } as unknown as jest.Mocked<SwaggerService>;
    controller = new SwaggerController(swaggerService);
    jest.clearAllMocks();
    (SwaggerController as unknown as { rootModule?: unknown }).rootModule = undefined;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return swagger spec from generateAutoSpec', async () => {
    class AppModule {}
    SwaggerController.setRootModule(AppModule);

    const mockSpec = {
      openapi: '3.0.0',
      info: {
        title: 'API Documentation',
        version: '1.0.0',
        description: 'Test',
      },
      paths: { '/x': { get: { summary: 'x' } } },
      components: {
        schemas: {},
      },
    };

    swaggerService.generateAutoSpec.mockReturnValue(mockSpec as never);
    const spec = await controller.getSpec({} as RequestContext);
    expect(spec).toEqual(mockSpec);
    expect(swaggerService.generateAutoSpec).toHaveBeenCalledWith(AppModule, expect.any(Object));
  });

  describe('getSpec', () => {
    it('should call generateAutoSpec with root module', async (): Promise<void> => {
      const mockSpec = {
        openapi: '3.0.0',
        info: {
          title: 'API',
          version: '1.0.0',
        },
        paths: { '/a': { get: { summary: 'a' } } },
        components: { schemas: { Error: { type: 'object' } } },
      };

      class TestModule {}
      SwaggerController.setRootModule(TestModule);

      swaggerService.generateAutoSpec.mockReturnValue(mockSpec as never);

      const result = await controller.getSpec({} as RequestContext);

      expect(result).toEqual(mockSpec);
      expect(swaggerService.generateAutoSpec).toHaveBeenCalledWith(TestModule, expect.any(Object));
    });

    it('should handle errors', async (): Promise<void> => {
      const error = new Error('Test error');
      swaggerService.generateAutoSpec.mockImplementation(() => {
        throw error;
      });

      class TestModule {}
      SwaggerController.setRootModule(TestModule);

      await expect(controller.getSpec({} as RequestContext)).rejects.toThrow('Test error');
    });
  });

  describe('getSpec edge cases', () => {
    it('should return default spec when no root module is set', async (): Promise<void> => {
      const result = await controller.getSpec({} as RequestContext);

      expect(result).toEqual({
        openapi: '3.0.0',
        info: {
          title: 'API Documentation',
          version: '1.0.0',
          description: 'No root module provided',
        },
        paths: {},
        components: {
          schemas: {},
        },
      });
    });

    it('should annotate description when spec has no paths', async (): Promise<void> => {
      class TestModule {}
      SwaggerController.setRootModule(TestModule);

      swaggerService.generateAutoSpec.mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'T', version: '1' },
        paths: {},
        components: { schemas: {} },
      } as never);

      const result = await controller.getSpec({} as RequestContext);
      expect(result.paths).toEqual({});
      expect(result.info.description).toBe('No routes found');
    });
  });

  describe('getDocs', () => {
    it('should return Swagger UI HTML with default CDN', async (): Promise<void> => {
      const result = await controller.getDocs({} as RequestContext);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('API Documentation');
      expect(result).toContain('https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css');
      expect(result).toContain('"/swagger/spec"');
    });

    it('should use globalPrefix and custom CDN when configured', async (): Promise<void> => {
      SwaggerModule.configure(
        {
          globalPrefix: '/api',
          swaggerUiCdnBase: 'https://cdn.example.com/ui',
        },
        true
      );

      const result = await controller.getDocs({} as RequestContext);

      expect(result).toContain('https://cdn.example.com/ui/swagger-ui.css');
      expect(result).toContain('"/api/swagger/spec"');
    });
  });
});
