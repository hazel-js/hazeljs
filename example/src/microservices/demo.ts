/**
 * Microservices Demo Script
 *
 * Starts all services in the SAME PROCESS so they can share the registry.
 * The API Gateway uses config-driven routing (@hazeljs/gateway + @hazeljs/config):
 *   - Routes, circuit breakers, canary deployments, rate limits all come from env vars
 *   - See gateway.config.ts for the full list of configurable settings
 *   - Override any setting via environment variables without code changes
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from example root so all services see gateway/timeout/host settings
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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
  console.log('   The API Gateway reads its route config from environment variables.');
  console.log('   See gateway.config.ts and .env for configurable settings.');
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
    process.env.GATEWAY_PORT = '3003';
    await startAPIGateway();
    await sleep(2000);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ All services started successfully!\n');

    console.log('🎯 Try these commands:\n');

    console.log('# ── Via API Gateway (config-driven routes) ──\n');

    console.log('# Create a user (routed to user-service, circuit breaker + rate limit)');
    console.log('curl -X POST http://localhost:3003/api/users \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"name": "John Doe", "email": "john@example.com"}\'\n');

    console.log('# Get user');
    console.log('curl http://localhost:3003/api/users/1\n');

    console.log('# Create an order (routed to order-service, canary deployment active)');
    console.log('curl -X POST http://localhost:3003/api/orders \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"userId": "1", "items": ["item1"], "total": 99.99}\'\n');

    console.log('# Request a specific API version (payment-service v2)');
    console.log('curl http://localhost:3003/api/payments/charge \\');
    console.log('  -H "X-API-Version: v2"\n');

    console.log('# ── Gateway info endpoints ──\n');

    console.log('# View gateway routes (shows config-driven route details)');
    console.log('curl http://localhost:3003/gateway/routes\n');

    console.log('# Health check');
    console.log('curl http://localhost:3003/health\n');

    console.log('# ── Direct service access (bypasses gateway) ──\n');

    console.log('# User service directly');
    console.log('curl http://localhost:3001/users\n');

    console.log('# Order service directly');
    console.log('curl http://localhost:3002/orders\n');

    console.log('═'.repeat(60));
    console.log('\n📝 Tip: Change gateway behavior via env vars:');
    console.log('   ORDER_CANARY_WEIGHT=20      -> send 20% to canary');
    console.log('   USER_SVC_RATE_LIMIT_MAX=200  -> increase rate limit');
    console.log('   See .env and gateway.config.ts for all options.\n');
    console.log('Press Ctrl+C to stop all services\n');
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
