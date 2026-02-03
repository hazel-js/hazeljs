/**
 * Example: Agent Persistence Backends
 * 
 * Demonstrates:
 * - In-Memory state manager (default)
 * - Redis state manager for production
 * - Database state manager for audit trails
 * - How to configure and use different persistence backends
 * - Resuming paused executions with persistent state
 * 
 * Prerequisites:
 * - For Redis: npm install redis (optional)
 * - For Database: npm install @prisma/client (optional)
 * - Set REDIS_URL environment variable for Redis example
 * - Set DATABASE_URL environment variable for Database example
 * 
 * Usage:
 * - Set PERSISTENCE_BACKEND=memory|redis|database
 * - Run: npx ts-node example/src/agent/persistence-backends.example.ts
 */

import {
  Agent,
  Tool,
  AgentRuntime,
  AgentStateManager,
  RedisStateManager,
  DatabaseStateManager,
  AgentEventType,
} from '@hazeljs/agent';
import { MemoryManager, BufferMemory } from '@hazeljs/rag';
import { OpenAIProvider } from '@hazeljs/ai';

/**
 * Simple Agent for demonstration
 */
@Agent({
  name: 'persistence-demo-agent',
  description: 'Agent demonstrating different persistence backends',
  systemPrompt: 'You are a helpful assistant that can pause and resume tasks.',
  maxSteps: 10,
})
class PersistenceDemoAgent {
  @Tool({
    description: 'Process a task that might need to pause',
    parameters: [
      {
        name: 'task',
        type: 'string',
        required: true,
        description: 'Task to process',
      },
      {
        name: 'pauseAfter',
        type: 'number',
        required: false,
        description: 'Pause after this many steps (for demo)',
      },
    ],
  })
  async processTask(input: { task: string; pauseAfter?: number }) {
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      success: true,
      result: `Processed: ${input.task}`,
      timestamp: new Date().toISOString(),
    };
  }

  @Tool({
    description: 'Ask user for input (triggers pause)',
    parameters: [
      {
        name: 'question',
        type: 'string',
        required: true,
        description: 'Question to ask the user',
      },
    ],
    requiresApproval: false, // This will pause execution
  })
  async askUser(input: { question: string }) {
    // This will pause execution and wait for user input
    return {
      question: input.question,
      waiting: true,
    };
  }
}

/**
 * Create Redis state manager
 */
async function createRedisStateManager(): Promise<RedisStateManager> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('redis');

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`📦 Connecting to Redis at ${redisUrl}...`);

    const client = createClient({ url: redisUrl });
    await client.connect();

    console.log('✅ Redis connected successfully');

    return new RedisStateManager({
      client,
      keyPrefix: 'agent:state:',
      defaultTTL: 3600, // 1 hour for active contexts
      completedTTL: 86400, // 24 hours for completed
      failedTTL: 604800, // 7 days for failed
    });
  } catch (error) {
    console.error('❌ Failed to create Redis state manager:', error);
    console.log('💡 Falling back to in-memory state manager');
    throw error;
  }
}

/**
 * Create Database state manager
 */
async function createDatabaseStateManager(): Promise<DatabaseStateManager> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    console.log('📦 Connecting to database...');

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    return new DatabaseStateManager({
      client: prisma,
      softDelete: true, // Keep deleted contexts for audit
      autoArchive: false,
    });
  } catch (error) {
    console.error('❌ Failed to create Database state manager:', error);
    console.log('💡 Make sure you have:');
    console.log('   1. Installed @prisma/client');
    console.log('   2. Set DATABASE_URL environment variable');
    console.log('   3. Run prisma migrate dev to create tables');
    throw error;
  }
}

/**
 * Create state manager based on environment
 */
async function createStateManager(backend: string): Promise<AgentStateManager | RedisStateManager | DatabaseStateManager> {
  switch (backend.toLowerCase()) {
    case 'redis':
      return await createRedisStateManager();
    case 'database':
    case 'db':
      return await createDatabaseStateManager();
    case 'memory':
    default:
      console.log('📦 Using in-memory state manager (default)');
      return new AgentStateManager();
  }
}

/**
 * Main example function
 */
async function main() {
  const backend = process.env.PERSISTENCE_BACKEND || 'memory';

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Agent Persistence Backends Example                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`🔧 Using persistence backend: ${backend.toUpperCase()}\n`);

  try {
    // Create state manager
    const stateManager = await createStateManager(backend);

    // Initialize memory (using in-memory for simplicity)
    const bufferStore = new BufferMemory({ maxSize: 100 });
    await bufferStore.initialize();
    const memoryManager = new MemoryManager(bufferStore);

    // Initialize LLM provider (optional - for real execution)
    let llmProvider;
    if (process.env.OPENAI_API_KEY) {
      const openaiProvider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
        defaultModel: 'gpt-4-turbo-preview',
      });

      llmProvider = {
        chat: async (options: any) => {
          const response = await openaiProvider.complete({
            messages: options.messages,
            temperature: 0.3,
            maxTokens: 2000,
          });

          return {
            content: response.content,
            tool_calls: response.functionCall ? [response.functionCall] : undefined,
          };
        },
      };
    }

    // Create runtime with custom state manager
    const runtime = new AgentRuntime({
      stateManager,
      memoryManager,
      llmProvider,
      defaultMaxSteps: 10,
      enableMetrics: true,
    });

    console.log('✅ Agent runtime initialized with custom state manager\n');

    // Register agent
    runtime.registerAgent(PersistenceDemoAgent);

    // Example 1: Execute and track state
    console.log('📝 Example 1: Execute agent and track state\n');
    console.log('Executing agent with input: "Process order #12345"...\n');

    const result1 = await runtime.execute('persistence-demo-agent', 'Process order #12345', {
      sessionId: 'session-1',
      userId: 'user-1',
      metadata: { example: 'persistence-demo' },
    });

    console.log('Execution result:');
    console.log(`  Execution ID: ${result1.executionId}`);
    console.log(`  State: ${result1.state}`);
    console.log(`  Steps: ${result1.steps?.length || 0}`);
    console.log(`  Duration: ${result1.duration}ms\n`);

    // Example 2: Retrieve context after execution
    console.log('📝 Example 2: Retrieve execution context\n');

    const context = await runtime.getContext(result1.executionId);
    if (context) {
      console.log('Retrieved context:');
      console.log(`  Agent ID: ${context.agentId}`);
      console.log(`  Session ID: ${context.sessionId}`);
      console.log(`  State: ${context.state}`);
      console.log(`  Steps: ${context.steps.length}`);
      console.log(`  Created: ${context.createdAt.toISOString()}`);
      console.log(`  Updated: ${context.updatedAt.toISOString()}\n`);
    } else {
      console.log('⚠️  Context not found (may have expired if using Redis with TTL)\n');
    }

    // Example 3: Get all contexts for a session
    console.log('📝 Example 3: Get all contexts for a session\n');

    if (stateManager instanceof AgentStateManager) {
      const sessionContexts = stateManager.getSessionContexts('session-1');
      console.log(`Found ${sessionContexts.length} contexts for session-1\n`);
    } else {
      // For async state managers
      const sessionContexts = await stateManager.getSessionContexts('session-1');
      console.log(`Found ${sessionContexts.length} contexts for session-1\n`);
    }

    // Example 4: Demonstrate persistence across restarts (Redis/Database)
    if (backend !== 'memory') {
      console.log('📝 Example 4: Persistence across restarts\n');
      console.log('💡 With Redis/Database, you can:');
      console.log('   1. Stop the application');
      console.log('   2. Restart it');
      console.log('   3. Retrieve the same execution context using executionId');
      console.log(`   Execution ID to test: ${result1.executionId}\n`);
    }

    // Example 5: Event monitoring
    console.log('📝 Example 5: Event monitoring\n');

    runtime.on(AgentEventType.EXECUTION_STARTED, (event) => {
      console.log('  🔵 Execution started:', event);
    });

    runtime.on(AgentEventType.EXECUTION_COMPLETED, (event) => {
      console.log('  🟢 Execution completed:', event);
    });

    runtime.on(AgentEventType.EXECUTION_FAILED, (event) => {
      console.log('  🔴 Execution failed:', event);
    });

    // Run another execution to see events
    console.log('Executing another task to demonstrate events...\n');
    await runtime.execute('persistence-demo-agent', 'Calculate total for items', {
      sessionId: 'session-1',
    });

    console.log('\n✅ Examples completed successfully!\n');

    // Cleanup
    if (backend === 'redis') {
      console.log('🧹 Cleaning up Redis connections...');
      // Redis client cleanup would go here
    } else if (backend === 'database') {
      console.log('🧹 Disconnecting from database...');
      // Prisma disconnect would go here
    }

    console.log('\n💡 Tips:');
    console.log('  - Use Redis for production (fast, distributed, TTL support)');
    console.log('  - Use Database for audit trails and analytics');
    console.log('  - Use In-Memory for development and testing');
    console.log('  - See PERSISTENCE.md for detailed configuration\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main, PersistenceDemoAgent };
