import { Service } from '@hazeljs/core';
import type {
  SwaggerBuildOptions,
  SwaggerOperation,
  SwaggerSchema,
  SwaggerSpec,
} from './swagger.types';
import { getSwaggerMetadata, getOperationMetadata } from './swagger.decorator';
import logger from '@hazeljs/core';
import { Type } from '@hazeljs/core';
import { collectControllersFromModule } from '@hazeljs/core';

interface RouteMetadata {
  propertyKey: string | symbol;
  path: string;
  method: string;
}

@Service()
export class SwaggerService {
  private spec: SwaggerSpec = {
    openapi: '3.0.0',
    info: {},
    paths: {},
    components: {
      schemas: {},
    },
  };

  /** Build spec by walking the module tree (imports + controllers). */
  generateAutoSpec(moduleType: Type<unknown>, options?: SwaggerBuildOptions): SwaggerSpec {
    try {
      logger.debug('Auto-generating Swagger spec from module:', moduleType.name);
      const controllers = collectControllersFromModule(moduleType);
      return this.buildOpenApiFromControllers(controllers, options);
    } catch (error) {
      logger.error('Failed to auto-generate Swagger specification:', error);
      throw error;
    }
  }

  /**
   * Build spec from an explicit controller list.
   * Controllers do not require `@Swagger` on the class; routes without `@ApiOperation`
   * are filled when `autoGenerateOperations` is true (default).
   */
  generateSpec(controllers: Type<unknown>[], options?: SwaggerBuildOptions): SwaggerSpec {
    try {
      if (!Array.isArray(controllers)) {
        throw new Error('Controllers must be an array');
      }

      logger.debug(
        'Generating spec for controllers:',
        controllers.map((c) => c?.name || 'undefined')
      );

      return this.buildOpenApiFromControllers(controllers, options);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        logger.error('Failed to generate Swagger specification:', error);
      }
      throw error;
    }
  }

  private buildOpenApiFromControllers(
    controllers: Type<unknown>[],
    options: SwaggerBuildOptions = {}
  ): SwaggerSpec {
    const autoGenerateOps = options.autoGenerateOperations !== false;

    this.spec = {
      openapi: '3.0.0',
      info: {},
      paths: {},
      components: {
        schemas: {},
      },
    };

    if (options.title !== undefined) {
      this.spec.info.title = options.title;
    }
    if (options.description !== undefined) {
      this.spec.info.description = options.description;
    }
    if (options.version !== undefined) {
      this.spec.info.version = options.version;
    }

    if (options.servers?.length) {
      this.spec.servers = options.servers;
    }

    if (options.securitySchemes && Object.keys(options.securitySchemes).length > 0) {
      this.spec.components.securitySchemes = { ...options.securitySchemes };
    }

    if (options.security?.length) {
      this.spec.security = options.security;
    }

    this.addDefaultSchemas();

    const pathPrefix = this.normalizePrefix(options.globalPrefix);

    for (const controller of controllers) {
      if (!controller || typeof controller !== 'function') {
        if (process.env.NODE_ENV !== 'test') {
          logger.warn('Invalid controller found:', controller);
        }
        continue;
      }

      const swaggerOptions = getSwaggerMetadata(controller.prototype);
      if (swaggerOptions) {
        if (!this.spec.info.title) {
          this.spec.info = {
            title: swaggerOptions.title,
            description: swaggerOptions.description,
            version: swaggerOptions.version,
          };
        }
        if (swaggerOptions.tags && !this.spec.tags?.length) {
          this.spec.tags = swaggerOptions.tags;
        }
      }

      this.processControllerRoutes(controller, pathPrefix, autoGenerateOps);
    }

    if (!this.spec.info.title) {
      this.spec.info.title = 'HazelJS API';
    }
    if (!this.spec.info.description) {
      this.spec.info.description = 'API documentation';
    }
    if (!this.spec.info.version) {
      this.spec.info.version = '1.0.0';
    }

    logger.debug('Generated Swagger specification:', this.spec);
    return this.spec;
  }

  private normalizePrefix(prefix: string | undefined): string {
    if (!prefix) return '';
    let p = prefix.startsWith('/') ? prefix : `/${prefix}`;
    p = p.replace(/\/$/, '');
    return p;
  }

  private joinPathSegments(...segments: string[]): string {
    const parts: string[] = [];
    for (const seg of segments) {
      if (!seg) continue;
      for (const piece of String(seg).split('/')) {
        if (piece) parts.push(piece);
      }
    }
    return parts.length ? `/${parts.join('/')}` : '';
  }

  private processControllerRoutes(
    controller: Type<unknown>,
    pathPrefix: string,
    autoGenerateOps: boolean
  ): void {
    const controllerMetadata = Reflect.getMetadata('hazel:controller', controller) || {};
    const basePath = controllerMetadata.path || '';

    const apiTags = Reflect.getMetadata('hazel:api:tags', controller) || [];
    const controllerTag = {
      name: apiTags.length > 0 ? apiTags[0] : controller.name,
      description: `${controller.name} endpoints`,
    };

    const routes = (Reflect.getMetadata('hazel:routes', controller) as RouteMetadata[]) || [];
    for (const route of routes) {
      this.processRoute(
        controller,
        route,
        basePath,
        pathPrefix,
        controllerTag.name,
        autoGenerateOps
      );
    }
  }

  private processRoute(
    controller: Type<unknown>,
    route: RouteMetadata,
    basePath: string,
    pathPrefix: string,
    tag: string,
    autoGenerateOps: boolean
  ): void {
    const { path, method, propertyKey } = route;
    const fullPath = this.normalizePath(this.joinPathSegments(pathPrefix, basePath, path));
    const pathForParams = this.joinPathSegments(basePath, path);

    let operation = getOperationMetadata(controller.prototype, propertyKey);
    if (!operation && autoGenerateOps) {
      operation = this.generateAutoOperation(method, propertyKey, tag, pathForParams);
    }

    if (!operation) return;

    const pathItem = this.spec.paths[fullPath] || {};
    pathItem[method.toLowerCase()] = {
      ...operation,
      tags: operation.tags || [tag],
    };

    this.spec.paths[fullPath] = pathItem;
  }

  private generateAutoOperation(
    method: string,
    propertyKey: string | symbol,
    tag: string,
    pathForParams: string
  ): SwaggerOperation {
    const methodName = String(propertyKey);
    const m = method.toLowerCase();
    const isGetMethod = m === 'get';
    const isPostMethod = m === 'post';
    const isPutMethod = m === 'put';
    const isPatchMethod = m === 'patch';
    const isDeleteMethod = m === 'delete';

    let summary = '';
    if (methodName.includes('create') || isPostMethod) {
      summary = `Create new resource`;
    } else if (methodName.includes('update') || isPutMethod || isPatchMethod) {
      summary = `Update resource`;
    } else if (methodName.includes('delete') || isDeleteMethod) {
      summary = `Delete resource`;
    } else if (methodName.includes('find') || isGetMethod) {
      summary = `Get resource(s)`;
    } else {
      summary = `${method.toUpperCase()} ${methodName}`;
    }

    const errorSchema: SwaggerSchema = { $ref: '#/components/schemas/Error' };

    const operation: SwaggerOperation = {
      summary,
      description: `Auto-generated ${method.toUpperCase()} operation`,
      tags: [tag],
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: errorSchema,
            },
          },
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: errorSchema,
            },
          },
        },
      },
    };

    const pathParams = this.extractPathParameters(pathForParams);

    if (pathParams.length > 0) {
      operation.parameters = pathParams.map((param: string) => ({
        name: param,
        in: 'path' as const,
        required: true,
        schema: { type: 'string' as const },
      }));
    }

    if (isPostMethod || isPutMethod || isPatchMethod) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object' as const,
            },
          },
        },
      };
    }

    return operation;
  }

  private extractPathParameters(routePath: string): string[] {
    const params: string[] = [];
    const paramRegex = /:([^/]+)/g;
    let match;

    while ((match = paramRegex.exec(routePath)) !== null) {
      params.push(match[1]);
    }

    return params;
  }

  private addDefaultSchemas(): void {
    this.spec.components.schemas.Error = {
      type: 'object' as const,
      properties: {
        error: {
          type: 'object' as const,
          properties: {
            message: { type: 'string' as const },
            statusCode: { type: 'number' as const },
            timestamp: { type: 'string' as const, format: 'date-time' },
          },
        },
      },
    };

    this.spec.components.schemas.ValidationError = {
      type: 'object' as const,
      properties: {
        error: {
          type: 'object' as const,
          properties: {
            message: { type: 'string' as const },
            statusCode: { type: 'number' as const },
            timestamp: { type: 'string' as const, format: 'date-time' },
            errors: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  field: { type: 'string' as const },
                  message: { type: 'string' as const },
                },
              },
            },
          },
        },
      },
    };
  }

  private normalizePath(path: string): string {
    let normalized = path.replace(/\/$/, '');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized || '/';
  }
}
