/**
 * Microservices Demo Script
 * Starts all services in the SAME PROCESS so they can share the registry
 */

import { startUserService } from './user-service';
import { startOrderService } from './order-service';
import { startAPIGateway } from './api-gateway';

async function runDemo() {
  console.log('🚀 Starting HazelJS Microservices Demo');
  console.log('═'.repeat(60));
  console.log('');
  console.log('⚠️  NOTE: All services run in the same process to share the registry.');
  console.log('   In production, use Redis/Consul for distributed registry.');
  console.log('');
  console.log('═'.repeat(60));

  try {
    // Start all services sequentially (same process)
    console.log('\n📦 Starting User Service (Port 3001)...');
    process.env.PORT = '3001';
    await startUserService();
    await sleep(1000);

    console.log('📦 Starting Order Service (Port 3002)...');
    process.env.PORT = '3002';
    await startOrderService();
    await sleep(1000);

    console.log('📦 Starting API Gateway (Port 3003)...');
    process.env.PORT = '3003';
    await startAPIGateway();
    await sleep(2000);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ All services started successfully!\n');

    console.log('🎯 Try these commands:\n');
    console.log('# Create a user');
    console.log('curl -X POST http://localhost:3003/users \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"name": "John Doe", "email": "john@example.com"}\'\n');

    console.log('# Get user');
    console.log('curl http://localhost:3003/users/1\n');

    console.log('# Create an order');
    console.log('curl -X POST http://localhost:3003/orders \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"userId": "1", "items": ["item1"], "total": 99.99}\'\n');

    console.log('# Get order (with user data)');
    console.log('curl http://localhost:3003/orders/1\n');

    console.log('# View all registered services');
    console.log('curl http://localhost:3003/services\n');

    console.log('═'.repeat(60));
    console.log('\nPress Ctrl+C to stop all services\n');
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the demo
if (require.main === module) {
  runDemo();
}

export { runDemo };
