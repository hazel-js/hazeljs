/**
 * @hazeljs/swagger - Swagger/OpenAPI module for HazelJS
 */

import type { Type } from '@hazeljs/core';
import { SwaggerService } from './swagger.service';
import type { SwaggerBuildOptions, SwaggerSpec } from './swagger.types';

export { SwaggerModule } from './swagger.module';
export { SwaggerService } from './swagger.service';
export {
  Swagger,
  ApiOperation,
  getSwaggerMetadata,
  getOperationMetadata,
} from './swagger.decorator';
export type {
  SwaggerOptions,
  SwaggerOperation,
  SwaggerSchema,
  SwaggerSpec,
  SwaggerServer,
  SwaggerBuildOptions,
  AutoSwaggerOptions,
  SwaggerModuleOptions,
} from './swagger.types';

/** Build an OpenAPI document without serving HTTP (e.g. CI export). */
export function createOpenApiDocument(
  rootModule: Type<unknown>,
  options?: SwaggerBuildOptions
): SwaggerSpec {
  return new SwaggerService().generateAutoSpec(rootModule, options);
}
