import { Controller, Get, Post, Body, Param } from '@hazeljs/core';
import { Version } from '@hazeljs/core';
import { Swagger, ApiOperation } from '@hazeljs/swagger';
import { DemoService } from './demo.service';

/**
 * Demo controller showcasing new HazelJS v0.2.0 features
 */
@Controller('/demo')
@Swagger({
  title: 'Demo API',
  description: 'Demonstrates new features in HazelJS v0.2.0',
  version: '1.0.0',
  tags: [{ name: 'demo', description: 'Demo operations' }],
})
export class DemoController {
  constructor(private demoService: DemoService) {}

  /**
   * Example of optional parameters
   * GET /demo/optional or GET /demo/optional/123
   */
  @Get('/optional/:id?')
  @ApiOperation({
    summary: 'Optional parameter example',
    description: 'Demonstrates optional route parameters',
    tags: ['demo'],
  })
  async optionalParam(@Param('id') id?: string) {
    return {
      feature: 'Optional Parameters',
      id: id || 'not provided',
      message: id ? `Received ID: ${id}` : 'No ID provided',
    };
  }

  /**
   * Example of wildcard routes
   * GET /demo/wildcard/any/path/here
   */
  @Get('/wildcard/*')
  @ApiOperation({
    summary: 'Wildcard route example',
    description: 'Demonstrates wildcard route matching',
    tags: ['demo'],
  })
  async wildcardRoute(@Param('*') path: string) {
    return {
      feature: 'Wildcard Routes',
      path,
      message: `Matched wildcard path: ${path}`,
    };
  }

  /**
   * Example of scoped providers
   */
  @Get('/scoped')
  @ApiOperation({
    summary: 'Scoped provider example',
    description: 'Demonstrates request-scoped providers',
    tags: ['demo'],
  })
  async scopedProvider() {
    const requestId = this.demoService.getRequestId();
    return {
      feature: 'Scoped Providers',
      requestId,
      message: 'Each request gets a unique ID from request-scoped service',
    };
  }

  /**
   * Example of configuration service
   */
  @Get('/config')
  @ApiOperation({
    summary: 'Configuration example',
    description: 'Demonstrates ConfigService usage',
    tags: ['demo'],
  })
  async configExample() {
    const config = this.demoService.getConfig();
    return {
      feature: 'Configuration Module',
      config,
      message: 'Configuration loaded from .env files',
    };
  }
}

/**
 * Version 1 of the API
 */
@Controller('/demo/versioned')
@Version('1')
@Swagger({
  title: 'Demo API v1',
  description: 'Version 1 of the demo API',
  version: '1.0.0',
})
export class DemoV1Controller {
  @Get()
  @ApiOperation({
    summary: 'Get demo data v1',
    description: 'Returns version 1 data format',
    tags: ['demo'],
  })
  async getData() {
    return {
      version: 1,
      data: { message: 'This is version 1' },
    };
  }
}

/**
 * Version 2 of the API with enhanced features
 */
@Controller('/demo/versioned')
@Version('2')
@Swagger({
  title: 'Demo API v2',
  description: 'Version 2 of the demo API with enhanced features',
  version: '2.0.0',
})
export class DemoV2Controller {
  @Get()
  @ApiOperation({
    summary: 'Get demo data v2',
    description: 'Returns version 2 data format with metadata',
    tags: ['demo'],
  })
  async getData() {
    return {
      version: 2,
      data: { message: 'This is version 2' },
      metadata: {
        timestamp: new Date().toISOString(),
        features: ['enhanced', 'improved'],
      },
    };
  }
}
