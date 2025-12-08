import 'reflect-metadata';
import {
  Swagger,
  ApiOperation,
  getSwaggerMetadata,
  getOperationMetadata,
} from './swagger.decorator';
import { SwaggerOptions, SwaggerOperation } from './swagger.types';

describe('Swagger Decorators', () => {
  describe('@Swagger', () => {
    it('should store metadata on the prototype', (): void => {
      const options: SwaggerOptions = {
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
        tags: [{ name: 'test', description: 'Test operations' }],
      };

      @Swagger(options)
      class TestController {}

      const metadata = getSwaggerMetadata(TestController.prototype);
      expect(metadata).toBeDefined();
      expect(metadata).toEqual(options);
    });

    it('should handle undefined metadata', (): void => {
      class TestController {}

      const metadata = getSwaggerMetadata(TestController.prototype);
      expect(metadata).toBeUndefined();
    });
  });

  describe('@ApiOperation', () => {
    it('should store operation metadata on the prototype', (): void => {
      const operation: SwaggerOperation = {
        summary: 'Test operation',
        description: 'Test operation description',
        tags: ['test'],
        responses: {
          '200': {
            description: 'Success',
          },
        },
      };

      class TestController {
        @ApiOperation(operation)
        testMethod(): void {}
      }

      const metadata = getOperationMetadata(TestController.prototype, 'testMethod');
      expect(metadata).toBeDefined();
      expect(metadata).toEqual(operation);
    });

    it('should handle undefined operation metadata', (): void => {
      class TestController {
        testMethod(): void {}
      }

      const metadata = getOperationMetadata(TestController.prototype, 'testMethod');
      expect(metadata).toBeUndefined();
    });
  });
});
