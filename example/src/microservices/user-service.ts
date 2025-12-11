/**
 * User Service - Microservices Example
 * Demonstrates service registration with health checks
 */

import { HazelApp, HazelModule, Controller, Get, Post, Body, Param, Injectable } from '@hazeljs/core';
import { ServiceRegistry } from '@hazeljs/discovery';
import { sharedBackend } from './shared-registry';

// In-memory user storage
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const users = new Map<string, User>();

@Controller('/users')
@Injectable()
class UserController {
  @Get('/')
  async getAllUsers() {
    return {
      users: Array.from(users.values()),
      count: users.size,
    };
  }

  @Get('/:id')
  async getUser(@Param('id') id: string) {
    const user = users.get(id);
    if (!user) {
      return { error: 'User not found', status: 404 };
    }
    return user;
  }

  @Post('/')
  async createUser(@Body() body: { name: string; email: string }) {
    const id = String(users.size + 1);
    const user: User = {
      id,
      name: body.name,
      email: body.email,
      createdAt: new Date(),
    };
    users.set(id, user);
    return user;
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
      service: 'user-service',
      uptime: Date.now() - this.startTime,
      usersCount: users.size,
    };
  }
}

async function startUserService() {
  const port = parseInt(process.env.PORT || '3001');
  const zone = process.env.ZONE || 'us-east-1';

  // Create module
  @HazelModule({
    controllers: [UserController, HealthController],
  })
  class UserServiceModule {}

  // Create HazelJS app
  const app = new HazelApp(UserServiceModule);

  // Initialize service registry with shared backend
  const registry = new ServiceRegistry(
    {
      name: 'user-service',
      port,
      host: 'localhost',
      healthCheckPath: '/health',
      healthCheckInterval: 30000,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      zone,
      tags: ['api', 'users', 'microservice'],
    },
    sharedBackend
  );

  // Start the app
  await app.listen(port);
  console.log(`✅ User Service started on port ${port}`);

  // Register with service registry
  await registry.register();
  console.log(`✅ User Service registered in zone: ${zone}`);
  console.log(`📊 Service ID: ${registry.getInstance()?.id}`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down User Service...');
    await registry.deregister();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down User Service...');
    await registry.deregister();
    process.exit(0);
  });
}

// Start the service
if (require.main === module) {
  startUserService().catch((error) => {
    console.error('❌ Failed to start User Service:', error);
    process.exit(1);
  });
}

export { startUserService };
