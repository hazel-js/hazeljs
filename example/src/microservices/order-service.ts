/**
 * Order Service - Microservices Example
 * Demonstrates service discovery and calling other services
 */

import { HazelApp, HazelModule, Controller, Get, Post, Body, Param, Injectable } from '@hazeljs/core';
import { ServiceRegistry, DiscoveryClient, ServiceClient } from '@hazeljs/discovery';
import { sharedBackend } from './shared-registry';

// In-memory order storage
interface Order {
  id: string;
  userId: string;
  items: string[];
  total: number;
  createdAt: Date;
  user?: any; // User data from user-service
}

const orders = new Map<string, Order>();

@Controller('/orders')
@Injectable()
class OrderController {
  private userServiceClient: ServiceClient;

  constructor() {
    // Initialize discovery client
    const discoveryClient = new DiscoveryClient(
      {
        cacheEnabled: true,
        cacheTTL: 30000,
      },
      sharedBackend
    );

    // Create service client for user-service
    this.userServiceClient = new ServiceClient(discoveryClient, {
      serviceName: 'user-service',
      loadBalancingStrategy: 'round-robin',
      timeout: 5000,
      retries: 3,
    });
  }

  @Get('/')
  async getAllOrders() {
    return {
      orders: Array.from(orders.values()),
      count: orders.size,
    };
  }

  @Get('/:id')
  async getOrder(@Param('id') id: string) {
    const order = orders.get(id);
    if (!order) {
      return { error: 'Order not found', status: 404 };
    }

    // Fetch user data from user-service
    try {
      const userResponse = await this.userServiceClient.get(`/users/${order.userId}`);
      order.user = userResponse.data;
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      order.user = { error: 'User service unavailable' };
    }

    return order;
  }

  @Post('/')
  async createOrder(@Body() body: { userId: string; items: string[]; total: number }) {
    // Verify user exists by calling user-service
    try {
      const userResponse = await this.userServiceClient.get(`/users/${body.userId}`);
      const user = userResponse.data;

      if (user.error) {
        return { error: 'User not found', status: 404 };
      }

      const id = String(orders.size + 1);
      const order: Order = {
        id,
        userId: body.userId,
        items: body.items,
        total: body.total,
        createdAt: new Date(),
        user,
      };

      orders.set(id, order);
      console.log(`✅ Order created for user: ${user.name}`);
      return order;
    } catch (error) {
      console.error('Failed to create order:', error);
      return { error: 'Failed to verify user', status: 500 };
    }
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
      service: 'order-service',
      uptime: Date.now() - this.startTime,
      ordersCount: orders.size,
    };
  }
}

async function startOrderService() {
  const port = parseInt(process.env.PORT || '3002');
  const zone = process.env.ZONE || 'us-east-1';

  // Create module
  @HazelModule({
    controllers: [OrderController, HealthController],
  })
  class OrderServiceModule {}

  // Create HazelJS app
  const app = new HazelApp(OrderServiceModule);

  // Initialize service registry
  const registry = new ServiceRegistry(
    {
      name: 'order-service',
      port,
      host: 'localhost',
      healthCheckPath: '/health',
      healthCheckInterval: 30000,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      zone,
      tags: ['api', 'orders', 'microservice'],
    },
    sharedBackend
  );

  // Start the app
  await app.listen(port);
  console.log(`✅ Order Service started on port ${port}`);

  // Register with service registry
  await registry.register();
  console.log(`✅ Order Service registered in zone: ${zone}`);
  console.log(`📊 Service ID: ${registry.getInstance()?.id}`);

  // Discover user-service
  const discoveryClient = new DiscoveryClient({}, sharedBackend);
  const userInstances = await discoveryClient.getInstances('user-service');
  console.log(`🔍 Discovered ${userInstances.length} user-service instance(s)`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Order Service...');
    await registry.deregister();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Order Service...');
    await registry.deregister();
    process.exit(0);
  });
}

// Start the service
if (require.main === module) {
  startOrderService().catch((error) => {
    console.error('❌ Failed to start Order Service:', error);
    process.exit(1);
  });
}

export { startOrderService };
