import { SwaggerController } from './swagger.controller';
import { SwaggerService } from './swagger.service';
import { RequestContext, getModuleMetadata } from '@hazeljs/core';

// Mock the logger and getModuleMetadata
jest.mock('@hazeljs/core', () => {
  const actual = jest.requireActual('@hazeljs/core');
  return {
    ...actual,
    __esModule: true,
    getModuleMetadata: jest.fn(),
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
    swaggerService = {
      generateSpec: jest.fn(),
    } as any;
    controller = new SwaggerController(swaggerService);
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return swagger spec', async () => {
    const mockSpec = {
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
    };

    swaggerService.generateSpec.mockReturnValue(mockSpec);
    const spec = await controller.getSpec({} as any);
    expect(spec).toEqual(mockSpec);
  });

  describe('getSpec', () => {
    it('should return Swagger specification', async (): Promise<void> => {
      const mockSpec = {
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
      };

      // Set up the root module
      class TestModule {}
      SwaggerController.setRootModule(TestModule);

      // Mock getModuleMetadata to return some controllers
      (getModuleMetadata as jest.Mock).mockReturnValue({
        controllers: [class TestController {}],
        imports: [],
      });

      swaggerService.generateSpec.mockReturnValue(mockSpec);

      const context = {} as RequestContext;
      const result = await controller.getSpec(context);

      expect(result).toEqual(mockSpec);
      expect(swaggerService.generateSpec).toHaveBeenCalled();
    });

    it('should handle errors', async (): Promise<void> => {
      const error = new Error('Test error');
      swaggerService.generateSpec.mockImplementation(() => {
        throw error;
      });

      // Set up the root module
      class TestModule {}
      SwaggerController.setRootModule(TestModule);

      // Mock getModuleMetadata to return some controllers
      (getModuleMetadata as jest.Mock).mockReturnValue({
        controllers: [class TestController {}],
        imports: [],
      });

      const context = {} as RequestContext;
      await expect(controller.getSpec(context)).rejects.toThrow('Test error');
      expect(swaggerService.generateSpec).toHaveBeenCalled();
    });
  });

  describe('getSpec edge cases', () => {
    it('should return default spec when no root module is set', async (): Promise<void> => {
      // Clear root module by setting it to undefined directly
      (SwaggerController as any).rootModule = undefined;
      const context = {} as RequestContext;
      const result = await controller.getSpec(context);

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

    it('should handle module with no metadata', async (): Promise<void> => {
      class TestModule {}
      SwaggerController.setRootModule(TestModule);

      (getModuleMetadata as jest.Mock).mockReturnValue(null);

      const context = {} as RequestContext;
      const result = await controller.getSpec(context);

      expect(result).toEqual({
        openapi: '3.0.0',
        info: {
          title: 'API Documentation',
          version: '1.0.0',
          description: 'No controllers found',
        },
        paths: {},
        components: {
          schemas: {},
        },
      });
    });

    it('should handle module with no controllers', async (): Promise<void> => {
      class TestModule {}
      SwaggerController.setRootModule(TestModule);

      (getModuleMetadata as jest.Mock).mockReturnValue({
        controllers: [],
        imports: [],
      });

      const context = {} as RequestContext;
      const result = await controller.getSpec(context);

      expect(result).toEqual({
        openapi: '3.0.0',
        info: {
          title: 'API Documentation',
          version: '1.0.0',
          description: 'No controllers found',
        },
        paths: {},
        components: {
          schemas: {},
        },
      });
    });

    it('should handle module with no imports', async (): Promise<void> => {
      class TestModule {}
      class TestController {}
      SwaggerController.setRootModule(TestModule);

      (getModuleMetadata as jest.Mock).mockReturnValue({
        controllers: [TestController],
        imports: undefined,
      });

      swaggerService.generateSpec.mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} },
      });

      const context = {} as RequestContext;
      await controller.getSpec(context);

      expect(swaggerService.generateSpec).toHaveBeenCalledWith([TestController]);
    });

    it('should recursively collect controllers from imported modules', async (): Promise<void> => {
      class RootModule {}
      class ImportedModule {}
      class RootController {}
      class ImportedController {}

      SwaggerController.setRootModule(RootModule);

      (getModuleMetadata as jest.Mock).mockImplementation((moduleType: unknown) => {
        if (moduleType === RootModule) {
          return {
            controllers: [RootController],
            imports: [ImportedModule],
          };
        }
        if (moduleType === ImportedModule) {
          return {
            controllers: [ImportedController],
            imports: [],
          };
        }
        return null;
      });

      swaggerService.generateSpec.mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} },
      });

      const context = {} as RequestContext;
      await controller.getSpec(context);

      expect(swaggerService.generateSpec).toHaveBeenCalledWith(
        expect.arrayContaining([RootController, ImportedController])
      );
    });

    it('should filter out invalid controllers', async (): Promise<void> => {
      class TestModule {}
      class ValidController {}
      SwaggerController.setRootModule(TestModule);

      (getModuleMetadata as jest.Mock).mockReturnValue({
        controllers: [ValidController, null, undefined, {}],
        imports: [],
      });

      swaggerService.generateSpec.mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} },
      });

      const context = {} as RequestContext;
      await controller.getSpec(context);

      expect(swaggerService.generateSpec).toHaveBeenCalledWith([ValidController]);
    });
  });

  describe('getDocs', () => {
    it('should return Swagger UI HTML', async (): Promise<void> => {
      const context = {} as RequestContext;
      const result = await controller.getDocs(context);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('API Documentation');
      expect(result).toContain('Loading API Documentation...');
    });
  });
});
