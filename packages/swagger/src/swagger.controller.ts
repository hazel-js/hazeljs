import { Controller, Get } from '@hazeljs/core';
import { SwaggerService } from './swagger.service';
import { RequestContext, Type } from '@hazeljs/core';
import { getModuleMetadata, type DynamicModule } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { Swagger, ApiOperation } from './swagger.decorator';
import { SwaggerSpec } from './swagger.service';

@Swagger({
  title: 'Swagger Documentation',
  description: 'API documentation using Swagger/OpenAPI',
  version: '1.0.0',
  tags: [
    {
      name: 'swagger',
      description: 'Swagger documentation endpoints',
    },
  ],
})
@Controller({
  path: 'swagger',
})
export class SwaggerController {
  private static rootModule: Type<unknown>;

  constructor(private swaggerService: SwaggerService) {}

  static setRootModule(module: Type<unknown>): void {
    logger.debug(`Setting root module for SwaggerController: ${module.name}`);
    SwaggerController.rootModule = module;
  }

  @Get('/spec')
  @ApiOperation({
    summary: 'Get OpenAPI specification',
    description: 'Retrieves the OpenAPI specification for the API',
    tags: ['swagger'],
    responses: {
      '200': {
        description: 'OpenAPI specification retrieved successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                openapi: { type: 'string' },
                info: { type: 'object' },
                paths: { type: 'object' },
                components: { type: 'object' },
              },
            },
          },
        },
      },
    },
  })
  async getSpec(_context: RequestContext): Promise<SwaggerSpec> {
    try {
      if (!SwaggerController.rootModule) {
        logger.warn('No root module provided');
        return {
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
      }

      logger.debug('Root module:', SwaggerController.rootModule.name);

      // Get all controllers from the AppModule and its imported modules
      const moduleMetadata = getModuleMetadata(SwaggerController.rootModule);
      logger.debug('Module metadata:', JSON.stringify(moduleMetadata, null, 2));

      const controllers = new Set<Type<unknown>>();

      // Helper function to recursively collect controllers from modules
      const collectControllers = (moduleRef: Type<unknown> | DynamicModule): void => {
        const moduleName =
          typeof moduleRef === 'function'
            ? moduleRef.name
            : (moduleRef as DynamicModule).module?.name;
        logger.debug(`Collecting controllers from module: ${moduleName}`);
        const metadata = getModuleMetadata(moduleRef as object);
        if (!metadata) {
          logger.warn(`No metadata found for module: ${moduleName}`);
          return;
        }

        // Add controllers from current module
        if (metadata.controllers) {
          const validControllers = metadata.controllers.filter(
            (c: unknown) => c && typeof c === 'function'
          );
          logger.debug(
            `${moduleName} controllers:`,
            validControllers.map((c: Type<unknown>) =>
              typeof c === 'function' ? c.name : undefined
            )
          );
          validControllers.forEach((controller: unknown) =>
            controllers.add(controller as Type<unknown>)
          );
        } else {
          logger.debug(`No controllers found in module: ${moduleName}`);
        }

        // Recursively process imported modules (Type or DynamicModule)
        if (metadata.imports) {
          const validModules = metadata.imports.filter(
            (m: unknown) =>
              m && (typeof m === 'function' || (typeof m === 'object' && 'module' in (m as object)))
          );
          logger.debug(
            `${moduleName} imported modules:`,
            validModules.map((m: Type<unknown> | DynamicModule) =>
              typeof m === 'function' ? m.name : (m as DynamicModule).module?.name
            )
          );
          validModules.forEach((moduleRef: Type<unknown> | DynamicModule) =>
            collectControllers(moduleRef)
          );
        } else {
          logger.debug(`No imports found in module: ${moduleName}`);
        }
      };

      // Start collecting controllers from the root module
      collectControllers(SwaggerController.rootModule);

      const controllerArray = Array.from(controllers);
      logger.debug('Total controllers found:', controllerArray.length);
      logger.debug(
        'Controller names:',
        controllerArray.map((c) => c.name)
      );

      if (controllerArray.length === 0) {
        logger.warn('No valid controllers found');
        return {
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
        };
      }

      const spec = this.swaggerService.generateSpec(controllerArray);
      return spec;
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        logger.error('Error generating Swagger spec:', error);
      }
      throw error;
    }
  }

  @Get('/')
  @ApiOperation({
    summary: 'Get Swagger UI',
    description: 'Serves the Swagger UI interface',
    tags: ['swagger'],
    responses: {
      '200': {
        description: 'Swagger UI HTML page',
        content: {
          'text/html': {
            schema: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async getDocs(_context: RequestContext): Promise<string> {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.18.3/swagger-ui.css" />
    <style>
        body {
            margin: 0;
            padding: 20px;
        }
        #swagger-ui {
            max-width: 1460px;
            margin: 0 auto;
        }
        .loading {
            text-align: center;
            padding: 20px;
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
    <div id="swagger-ui">
        <div class="loading">Loading API Documentation...</div>
    </div>

    <script src="https://unpkg.com/swagger-ui-dist@4.18.3/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.18.3/swagger-ui-standalone-preset.js"></script>
    <script>
        // Basic error handling
        window.onerror = function(msg, url, line) {
            document.getElementById('swagger-ui').innerHTML = 
                '<div style="color: red; padding: 20px;">Error: ' + msg + '<br>at line ' + line + '</div>';
            return false;
        };

        // Simple initialization
        const ui = SwaggerUIBundle({
            url: window.location.origin + "/swagger/spec",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "BaseLayout"
        });

        window.ui = ui;
    </script>
</body>
</html>
    `;
  }
}
