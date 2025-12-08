import { Controller, Get, Post, Body } from '@hazeljs/core';
import { Serverless } from '@hazeljs/serverless';
import { OptimizeColdStart } from '@hazeljs/serverless';
import { Swagger, ApiOperation } from '@hazeljs/swagger';
import { ServerlessService } from './serverless.service';

/**
 * Serverless controller demonstrating serverless-optimized endpoints
 */
@Controller('/serverless')
@Serverless({
  memory: 512,
  timeout: 30,
  coldStartOptimization: true,
  runtime: 'aws-lambda',
})
@Swagger({
  title: 'Serverless API',
  description: 'Serverless-optimized endpoints for AWS Lambda and Cloud Functions',
  version: '1.0.0',
  tags: [{ name: 'serverless', description: 'Serverless operations' }],
})
export class ServerlessController {
  constructor(private serverlessService: ServerlessService) {}

  /**
   * Simple serverless endpoint
   */
  @Get('/hello')
  @ApiOperation({
    summary: 'Hello from serverless',
    description: 'Simple serverless endpoint',
    tags: ['serverless'],
  })
  async hello() {
    return {
      message: 'Hello from HazelJS Serverless!',
      timestamp: new Date().toISOString(),
      coldStart: this.serverlessService.isColdStart(),
    };
  }

  /**
   * Optimized endpoint with cold start optimization
   */
  @Get('/optimized')
  @OptimizeColdStart()
  @ApiOperation({
    summary: 'Optimized endpoint',
    description: 'Endpoint with cold start optimization',
    tags: ['serverless'],
  })
  async optimized() {
    const stats = this.serverlessService.getStats();

    return {
      message: 'Optimized serverless endpoint',
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process data endpoint
   */
  @Post('/process')
  @ApiOperation({
    summary: 'Process data',
    description: 'Process data in serverless function',
    tags: ['serverless'],
  })
  async processData(@Body() data: any) {
    const result = await this.serverlessService.processData(data);

    return {
      message: 'Data processed successfully',
      result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get serverless metrics
   */
  @Get('/metrics')
  @ApiOperation({
    summary: 'Get metrics',
    description: 'Get serverless function metrics',
    tags: ['serverless'],
  })
  async getMetrics() {
    const metrics = this.serverlessService.getMetrics();

    return {
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check endpoint
   */
  @Get('/health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Serverless function health check',
    tags: ['serverless'],
  })
  async healthCheck() {
    const health = this.serverlessService.checkHealth();

    return {
      status: health.healthy ? 'healthy' : 'unhealthy',
      ...health,
      timestamp: new Date().toISOString(),
    };
  }
}
