import 'reflect-metadata';
import { SwaggerOptions, SwaggerOperation } from './swagger.types';

const SWAGGER_METADATA_KEY = 'swagger:options';
const SWAGGER_OPERATION_METADATA_KEY = 'swagger:operation';

export function Swagger(options: SwaggerOptions): ClassDecorator {
  return (target: object) => {
    const metaTarget =
      typeof target === 'function' ? (target as { prototype: object }).prototype : target;
    Reflect.defineMetadata(SWAGGER_METADATA_KEY, options, metaTarget);
  };
}

export function ApiOperation(operation: SwaggerOperation): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(SWAGGER_OPERATION_METADATA_KEY, operation, target, propertyKey);
  };
}

export function getSwaggerMetadata(target: object): SwaggerOptions | undefined {
  return Reflect.getMetadata(SWAGGER_METADATA_KEY, target);
}

export function getOperationMetadata(
  target: object,
  propertyKey: string | symbol
): SwaggerOperation | undefined {
  return Reflect.getMetadata(SWAGGER_OPERATION_METADATA_KEY, target, propertyKey);
}
