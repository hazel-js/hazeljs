/**
 * @hazeljs/swagger - Swagger/OpenAPI module for HazelJS
 */

export { SwaggerModule } from './swagger.module';
export { SwaggerService, type SwaggerSpec } from './swagger.service';
export {
  Swagger,
  ApiOperation,
  getSwaggerMetadata,
  getOperationMetadata,
} from './swagger.decorator';
export type { SwaggerOptions, SwaggerOperation, SwaggerSchema } from './swagger.types';

