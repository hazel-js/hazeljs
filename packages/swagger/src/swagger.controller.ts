import { Controller, Get } from '@hazeljs/core';
import { SwaggerService } from './swagger.service';
import { RequestContext, Type } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { Swagger, ApiOperation } from './swagger.decorator';
import type { SwaggerSpec } from './swagger.types';
import { getSwaggerModuleOptions } from './swagger-config';

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

  private static emptySpec(description: string): SwaggerSpec {
    return {
      openapi: '3.0.0',
      info: {
        title: 'API Documentation',
        version: '1.0.0',
        description,
      },
      paths: {},
      components: {
        schemas: {},
      },
    };
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
        return SwaggerController.emptySpec('No root module provided');
      }

      logger.debug('Root module:', SwaggerController.rootModule.name);

      const opts = getSwaggerModuleOptions();
      const spec = this.swaggerService.generateAutoSpec(SwaggerController.rootModule, opts);

      if (Object.keys(spec.paths).length === 0) {
        logger.warn('No routes found for OpenAPI document');
        return {
          ...spec,
          info: {
            ...spec.info,
            description: spec.info.description || 'No routes found',
          },
        };
      }

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
    const opts = getSwaggerModuleOptions();
    const cdn =
      opts.swaggerUiCdnBase?.replace(/\/$/, '') ?? 'https://unpkg.com/swagger-ui-dist@5.11.0';
    let prefix = opts.globalPrefix?.trim() ?? '';
    if (prefix && !prefix.startsWith('/')) {
      prefix = `/${prefix}`;
    }
    prefix = prefix.replace(/\/$/, '');
    const specPath = prefix ? `${prefix}/swagger/spec` : '/swagger/spec';

    return `<!DOCTYPE html>
<html>
<head>
    <title>API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="${cdn}/swagger-ui.css" />
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

    <script src="${cdn}/swagger-ui-bundle.js"></script>
    <script src="${cdn}/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onerror = function(msg, url, line) {
            document.getElementById('swagger-ui').innerHTML =
                '<div style="color: red; padding: 20px;">Error: ' + msg + '<br>at line ' + line + '</div>';
            return false;
        };

        const specPath = ${JSON.stringify(specPath)};
        const ui = SwaggerUIBundle({
            url: window.location.origin + specPath,
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
