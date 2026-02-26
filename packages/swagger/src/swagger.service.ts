import { Injectable } from '@hazeljs/core';
import { SwaggerOperation, SwaggerSchema } from './swagger.types';
import { getSwaggerMetadata, getOperationMetadata } from './swagger.decorator';
import logger from '@hazeljs/core';
import { Type } from '@hazeljs/core';

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

@Injectable()
export class SwaggerService {
  private spec: SwaggerSpec = {
    openapi: '3.0.0',
    info: {},
    paths: {},
    components: {
      schemas: {},
    },
  };

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
