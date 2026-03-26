import { Service } from '@hazeljs/core';
import { SwaggerOperation, SwaggerSchema } from './swagger.types';
import { getSwaggerMetadata, getOperationMetadata } from './swagger.decorator';
import logger from '@hazeljs/core';
import { Type } from '@hazeljs/core';
import { collectControllersFromModule } from '@hazeljs/core';

export interface AutoSwaggerOptions {
  title?: string;
  description?: string;
  version?: string;
  autoGenerateOperations?: boolean;
}

export interface SwaggerSpec {
  openapi: string;
  info: {
    title?: string;
    description?: string;
    version?: string;
  };
  paths: Record<string, Record<string, SwaggerOperation>>;
  components: {
    schemas: Record<string, SwaggerSchema>;
  };
  tags?: Array<{ name: string; description: string }>;
}

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

  // Auto-generate spec from module without explicit Swagger decorators
  generateAutoSpec(moduleType: Type<unknown>, options?: AutoSwaggerOptions): SwaggerSpec {
    try {
      logger.debug('Auto-generating Swagger spec from module:', moduleType.name);

      // Reset spec
      this.spec = {
        openapi: '3.0.0',
        info: {
          title: options?.title || 'HazelJS API',
          description: options?.description || 'Auto-generated API documentation',
          version: options?.version || '1.0.0',
        },
        paths: {},
        components: {
          schemas: {},
        },
        tags: [],
      };

      const controllers = collectControllersFromModule(moduleType);

      // Process each controller
      controllers.forEach((controller) => {
        this.processControllerAuto(controller, options?.autoGenerateOperations !== false);
      });

      // Add default error schemas
      this.addDefaultSchemas();

      logger.debug('Auto-generated Swagger specification completed');
      return this.spec;
    } catch (error) {
      logger.error('Failed to auto-generate Swagger specification:', error);
      throw error;
    }
  }

  private processControllerAuto(controller: Type<unknown>, autoGenerateOps: boolean): void {
    if (!controller) return;

    // Get controller path from metadata
    const controllerMetadata = Reflect.getMetadata('hazel:controller', controller) || {};
    const basePath = controllerMetadata.path || '';

    // Get API tags from metadata
    const apiTags = Reflect.getMetadata('hazel:api:tags', controller) || [];

    // Add controller as a tag if not already present
    if (!this.spec.tags) this.spec.tags = [];
    const controllerTag = {
      name: apiTags.length > 0 ? apiTags[0] : controller.name,
      description: `${controller.name} endpoints`,
    };

    if (!this.spec.tags.find((tag) => tag.name === controllerTag.name)) {
      this.spec.tags.push(controllerTag);
    }

    // Get route metadata
    const routes = (Reflect.getMetadata('hazel:routes', controller) as RouteMetadata[]) || [];

    // Process each route
    routes.forEach((route) => {
      this.processRouteAuto(controller, route, basePath, controllerTag.name, autoGenerateOps);
    });
  }

  private processRouteAuto(
    controller: Type<unknown>,
    route: RouteMetadata,
    basePath: string,
    tag: string,
    autoGenerateOps: boolean
  ): void {
    const { path, method, propertyKey } = route;
    const fullPath = this.normalizePath(`${basePath}${path}`);

    // Check for existing operation metadata
    let operation = getOperationMetadata(controller.prototype, propertyKey);

    // Auto-generate operation if not found and auto-generation is enabled
    if (!operation && autoGenerateOps) {
      operation = this.generateAutoOperation(method, propertyKey, tag, route);
    }

    if (!operation) return;

    // Add operation to paths
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
    route: RouteMetadata
  ): SwaggerOperation {
    const methodName = String(propertyKey);
    const isGetMethod = method.toLowerCase() === 'get';
    const isPostMethod = method.toLowerCase() === 'post';
    const isPutMethod = method.toLowerCase() === 'put';
    const isDeleteMethod = method.toLowerCase() === 'delete';

    // Generate summary based on method name
    let summary = '';
    if (methodName.includes('create') || isPostMethod) {
      summary = `Create new resource`;
    } else if (methodName.includes('update') || isPutMethod) {
      summary = `Update resource`;
    } else if (methodName.includes('delete') || isDeleteMethod) {
      summary = `Delete resource`;
    } else if (methodName.includes('find') || isGetMethod) {
      summary = `Get resource(s)`;
    } else {
      summary = `${method.toUpperCase()} ${methodName}`;
    }

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
      },
    };

    // Add parameters for path variables - need to extract from the route path
    const pathParams = this.extractPathParameters(route.path);
    if (pathParams.length > 0) {
      operation.parameters = pathParams.map((param: string) => ({
        name: param,
        in: 'path' as const,
        required: true,
        schema: { type: 'string' as const },
      }));
    }

    // Add request body for POST/PUT/PATCH
    if (isPostMethod || isPutMethod) {
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

    // Add common error responses
    if (operation.responses) {
      operation.responses['400'] = {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { type: 'object' as const },
          },
        },
      };

      operation.responses['500'] = {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { type: 'object' as const },
          },
        },
      };
    }

    return operation;
  }

  private extractPathParameters(path: string): string[] {
    const params: string[] = [];
    const paramRegex = /:([^/]+)/g;
    let match;

    while ((match = paramRegex.exec(path)) !== null) {
      params.push(match[1]);
    }

    return params;
  }

  private addDefaultSchemas(): void {
    // Add common error schemas
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

  generateSpec(controllers: Type<unknown>[]): SwaggerSpec {
    try {
      if (!Array.isArray(controllers)) {
        throw new Error('Controllers must be an array');
      }

      logger.debug(
        'Generating spec for controllers:',
        controllers.map((c) => c?.name || 'undefined')
      );

      // Reset spec
      this.spec = {
        openapi: '3.0.0',
        info: {},
        paths: {},
        components: {
          schemas: {},
        },
      };

      // Process each controller
      controllers.forEach((controller) => {
        if (!controller || typeof controller !== 'function') {
          if (process.env.NODE_ENV !== 'test') {
            logger.warn('Invalid controller found:', controller);
          }
          return;
        }

        // Get Swagger metadata from the controller prototype
        const swaggerOptions = getSwaggerMetadata(controller.prototype);
        if (!swaggerOptions) {
          logger.debug(`No Swagger metadata found for controller: ${controller.name}`);
          return;
        }

        logger.debug(`Processing controller: ${controller.name}`, swaggerOptions);

        // Update info if not already set
        if (!this.spec.info.title) {
          this.spec.info = {
            title: swaggerOptions.title,
            description: swaggerOptions.description,
            version: swaggerOptions.version,
          };
        }

        // Add tags if not already set
        if (swaggerOptions.tags && !this.spec.tags) {
          this.spec.tags = swaggerOptions.tags;
        }

        // Get controller path from metadata
        const controllerMetadata = Reflect.getMetadata('hazel:controller', controller) || {};
        const basePath = controllerMetadata.path || '';

        // Get route metadata
        const routes = Reflect.getMetadata('hazel:routes', controller) as
          | RouteMetadata[]
          | undefined;
        if (!routes) {
          logger.debug(`No routes found for controller: ${controller.name}`);
          return;
        }

        logger.debug(`Found routes for ${controller.name}:`, routes);

        // Process each route
        routes.forEach((route) => {
          const { path, method, propertyKey } = route;
          const fullPath = this.normalizePath(`${basePath}${path}`);
          const operation = getOperationMetadata(controller.prototype, propertyKey);

          if (!operation) {
            logger.debug(`No operation metadata found for method: ${String(propertyKey)}`);
            return;
          }

          logger.debug(`Adding operation for ${method} ${fullPath}`);

          // Add operation to paths
          const pathItem = this.spec.paths[fullPath] || {};
          pathItem[method.toLowerCase()] = {
            ...operation,
            tags: operation.tags || [controller.name],
          };

          this.spec.paths[fullPath] = pathItem;
        });
      });

      logger.debug('Generated Swagger specification:', this.spec);
      return this.spec;
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        logger.error('Failed to generate Swagger specification:', error);
      }
      throw error;
    }
  }

  private normalizePath(path: string): string {
    // Remove trailing slash
    let normalized = path.replace(/\/$/, '');
    // Ensure path starts with slash
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized;
  }
}
