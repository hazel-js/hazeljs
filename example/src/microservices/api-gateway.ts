/**
 * API Gateway - Microservices Example
 * Demonstrates service discovery, load balancing, and routing
 */

import { HazelApp, HazelModule, Controller, Get, Post, Body, Param, Injectable } from '@hazeljs/core';
import { DiscoveryClient, ServiceClient, ServiceRegistry } from '@hazeljs/discovery';
import { sharedBackend } from './shared-registry';

@Controller('/users')
@Injectable()
class UserGatewayController {
  private userServiceClient: ServiceClient;

  constructor() {
    const discoveryClient = new DiscoveryClient(
      {
        cacheEnabled: true,
        cacheTTL: 30000,
      },
      sharedBackend
    );

    this.userServiceClient = new ServiceClient(discoveryClient, {
      serviceName: 'user-service',
      loadBalancingStrategy: 'round-robin',
      timeout: 5000,
      retries: 3,
    });
  }

  @Get('/')
  async getAllUsers() {
    try {
      const response = await this.userServiceClient.get('/users');
      return response.data;
    } catch (error: any) {
      return { error: 'User service unavailable', details: error.message };
    }
  }

  @Get('/:id')
  async getUser(@Param('id') id: string) {
    try {
      const response = await this.userServiceClient.get(`/users/${id}`);
      return response.data;
    } catch (error: any) {
      return { error: 'User service unavailable', details: error.message };
    }
  }

  @Post('/')
  async createUser(@Body() body: any) {
    try {
      const response = await this.userServiceClient.post('/users', body);
      return response.data;
    } catch (error: any) {
      return { error: 'User service unavailable', details: error.message };
    }
  }
}

@Controller('/orders')
@Injectable()
class OrderGatewayController {
  private orderServiceClient: ServiceClient;

  constructor() {
    const discoveryClient = new DiscoveryClient(
      {
        cacheEnabled: true,
        cacheTTL: 30000,
      },
      sharedBackend
    );

    this.orderServiceClient = new ServiceClient(discoveryClient, {
      serviceName: 'order-service',
      loadBalancingStrategy: 'round-robin',
      timeout: 5000,
      retries: 3,
    });
  }

  @Get('/')
  async getAllOrders() {
    try {
      const response = await this.orderServiceClient.get('/orders');
      return response.data;
    } catch (error: any) {
      return { error: 'Order service unavailable', details: error.message };
    }
  }

  @Get('/:id')
  async getOrder(@Param('id') id: string) {
    try {
      const response = await this.orderServiceClient.get(`/orders/${id}`);
      return response.data;
    } catch (error: any) {
      return { error: 'Order service unavailable', details: error.message };
    }
  }

  @Post('/')
  async createOrder(@Body() body: any) {
    try {
      const response = await this.orderServiceClient.post('/orders', body);
      return response.data;
    } catch (error: any) {
      return { error: 'Order service unavailable', details: error.message };
    }
  }
}

@Controller('/services')
@Injectable()
class ServiceDiscoveryController {
  private discoveryClient: DiscoveryClient;

  constructor() {
    this.discoveryClient = new DiscoveryClient({}, sharedBackend);
  }

  @Get('/')
  async getAllServices() {
    const services = await this.discoveryClient.getAllServices();
    const serviceDetails = await Promise.all(
      services.map(async (serviceName) => {
        const instances = await this.discoveryClient.getInstances(serviceName);
        return {
          name: serviceName,
          instanceCount: instances.length,
          instances: instances.map((i) => ({
            id: i.id,
            host: i.host,
            port: i.port,
            status: i.status,
            zone: i.zone,
            tags: i.tags,
            metadata: i.metadata,
          })),
        };
      })
    );

    return {
      totalServices: services.length,
      services: serviceDetails,
    };
  }

  @Get('/:serviceName')
  async getServiceInstances(@Param('serviceName') serviceName: string) {
    const instances = await this.discoveryClient.getInstances(serviceName);
    return {
      serviceName,
      instanceCount: instances.length,
      instances: instances.map((i) => ({
        id: i.id,
        host: i.host,
        port: i.port,
        status: i.status,
        zone: i.zone,
        tags: i.tags,
        metadata: i.metadata,
        lastHeartbeat: i.lastHeartbeat,
      })),
    };
  }
}

@Controller('/health')
@Injectable()
class HealthController {
  private startTime = Date.now();

  @Get('/')
  async healthCheck() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      uptime: Date.now() - this.startTime,
    };
  }
}

async function startAPIGateway() {
  const port = parseInt(process.env.PORT || '3003');
  const zone = process.env.ZONE || 'us-east-1';

  // Create module
  @HazelModule({
    controllers: [
      UserGatewayController,
      OrderGatewayController,
      ServiceDiscoveryController,
      HealthController,
    ],
  })
  class APIGatewayModule {}

  // Create HazelJS app
  const app = new HazelApp(APIGatewayModule);

  // Initialize service registry
  const registry = new ServiceRegistry(
    {
      name: 'api-gateway',
      port,
      host: 'localhost',
      healthCheckPath: '/health',
      healthCheckInterval: 30000,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      zone,
      tags: ['gateway', 'api', 'microservice'],
    },
    sharedBackend
  );

  // Start the app
  await app.listen(port);
  console.log(`✅ API Gateway started on port ${port}`);

  // Register with service registry
  await registry.register();
  console.log(`✅ API Gateway registered in zone: ${zone}`);
  console.log(`📊 Service ID: ${registry.getInstance()?.id}`);

  // Discover available services
  const discoveryClient = new DiscoveryClient({}, sharedBackend);
  const services = await discoveryClient.getAllServices();
  console.log(`🔍 Discovered ${services.length} service(s): ${services.join(', ')}`);

  console.log('\n📡 API Gateway Routes:');
  console.log(`  - GET    http://localhost:${port}/users`);
  console.log(`  - POST   http://localhost:${port}/users`);
  console.log(`  - GET    http://localhost:${port}/users/:id`);
  console.log(`  - GET    http://localhost:${port}/orders`);
  console.log(`  - POST   http://localhost:${port}/orders`);
  console.log(`  - GET    http://localhost:${port}/orders/:id`);
  console.log(`  - GET    http://localhost:${port}/services (discovery info)`);
  console.log(`  - GET    http://localhost:${port}/health\n`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down API Gateway...');
    await registry.deregister();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down API Gateway...');
    await registry.deregister();
    process.exit(0);
  });
}

// Start the gateway
if (require.main === module) {
  startAPIGateway().catch((error) => {
    console.error('❌ Failed to start API Gateway:', error);
    process.exit(1);
  });
}

export { startAPIGateway };
