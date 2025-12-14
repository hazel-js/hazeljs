/**
 * Production Features Example
 * Demonstrates all production-ready features of @hazeljs/agent
 * 
 * Features demonstrated:
 * - Rate limiting
 * - Structured logging
 * - Metrics collection
 * - Retry logic
 * - Circuit breaker
 * - Health checks
 */

import {
  Agent,
  Tool,
  AgentRuntime,
  AgentEventType,
  Logger,
  LogLevel,
} from '@hazeljs/agent';
import { MemoryManager, BufferMemory } from '@hazeljs/rag';
import { OpenAIProvider } from '@hazeljs/ai';

@Agent({
  name: 'production-agent',
  description: 'Production-ready agent with all features enabled',
  systemPrompt: 'You are a helpful assistant demonstrating production features.',
})
class ProductionAgent {
  @Tool({
    description: 'Simulate a reliable operation that always succeeds',
    parameters: [
      {
        name: 'message',
        type: 'string',
        required: true,
        description: 'Message to process',
      },
    ],
  })
  async reliableOperation(input: { message: string }) {
    return {
      success: true,
      result: `Processed: ${input.message}`,
      timestamp: new Date().toISOString(),
    };
  }

  @Tool({
    description: 'Simulate an unreliable operation that may fail (for testing retry logic)',
    parameters: [
      {
        name: 'failureRate',
        type: 'number',
        required: false,
        description: 'Probability of failure (0-1)',
      },
    ],
  })
  async unreliableOperation(input: { failureRate?: number }) {
    const failureRate = input.failureRate || 0.3;
    const shouldFail = Math.random() < failureRate;

    if (shouldFail) {
      throw new Error('Simulated transient failure - will be retried');
    }

    return {
      success: true,
      result: 'Operation succeeded after potential retries',
      timestamp: new Date().toISOString(),
    };
  }

  @Tool({
    description: 'Get system status and metrics',
    parameters: [],
  })
  async getSystemStatus() {
    return {
      status: 'operational',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Example 1: Basic Production Setup
 */
async function basicProductionSetup() {
  console.log('\n=== Example 1: Basic Production Setup ===\n');

  // Initialize memory manager
  const bufferStore = new BufferMemory({ maxSize: 100 });
  await bufferStore.initialize();

  const memoryManager = new MemoryManager(bufferStore, {
    maxConversationLength: 20,
    summarizeAfter: 50,
  });

  // Initialize OpenAI provider (optional - can work without it)
  const openaiProvider = process.env.OPENAI_API_KEY
    ? new OpenAIProvider(process.env.OPENAI_API_KEY, {
        defaultModel: 'gpt-4-turbo-preview',
      })
    : undefined;

  // Create LLM provider adapter
  const llmProvider = openaiProvider
    ? {
        chat: async (options: any) => {
          const response = await openaiProvider.complete({
            messages: options.messages,
            temperature: 0.3,
            maxTokens: 2000,
          });

          return {
            content: response.content,
            tool_calls: response.functionCall
              ? [
                  {
                    id: response.id,
                    type: 'function' as const,
                    function: {
                      name: response.functionCall.name,
                      arguments: response.functionCall.arguments,
                    },
                  },
                ]
              : [],
          };
        },
        isAvailable: async () => true,
      }
    : undefined;

  // Initialize runtime with ALL production features
  const runtime = new AgentRuntime({
    memoryManager,
    llmProvider,
    rateLimitPerMinute: 60, // 60 requests per minute
    enableMetrics: true,
    enableRetry: true,
    enableCircuitBreaker: true,
    logLevel: LogLevel.INFO,
    defaultMaxSteps: 10,
    enableObservability: true,
  });

  // Register agent class first, then instance
  runtime.registerAgent(ProductionAgent);
  const agent = new ProductionAgent();
  runtime.registerAgentInstance('production-agent', agent);

  console.log('✅ Production runtime initialized with:');
  console.log('   - Rate limiting: 60 requests/minute');
  console.log('   - Metrics collection: enabled');
  console.log('   - Retry logic: enabled (3 attempts)');
  console.log('   - Circuit breaker: enabled');
  console.log('   - Structured logging: INFO level');

  return runtime;
}

/**
 * Example 2: Rate Limiting Demonstration
 */
async function demonstrateRateLimiting(runtime: AgentRuntime) {
  console.log('\n=== Example 2: Rate Limiting ===\n');

  const rateLimiterStatus = runtime.getRateLimiterStatus();
  console.log('Rate limiter status:', rateLimiterStatus);

  console.log('\nSending 5 rapid requests...');

  for (let i = 1; i <= 5; i++) {
    try {
      const startTime = Date.now();
      await runtime.execute(
        'production-agent',
        `Request ${i}: Check system status`,
        { sessionId: 'rate-limit-demo' }
      );
      const duration = Date.now() - startTime;
      console.log(`✅ Request ${i} completed in ${duration}ms`);
    } catch (error) {
      console.log(`❌ Request ${i} failed:`, (error as Error).message);
    }
  }

  const updatedStatus = runtime.getRateLimiterStatus();
  console.log('\nRate limiter after requests:', updatedStatus);
}

/**
 * Example 3: Metrics and Health Checks
 */
async function demonstrateMetricsAndHealth(runtime: AgentRuntime) {
  console.log('\n=== Example 3: Metrics and Health Checks ===\n');

  // Execute some operations to generate metrics
  console.log('Executing operations to generate metrics...\n');

  for (let i = 1; i <= 3; i++) {
    await runtime.execute(
      'production-agent',
      `Operation ${i}: Process data`,
      { sessionId: 'metrics-demo' }
    );
  }

  // Get metrics
  console.log('📊 Current Metrics:');
  console.log(runtime.getMetricsSummary());

  // Get detailed metrics
  const detailedMetrics = runtime.getMetrics();
  if (detailedMetrics) {
    console.log('\n📈 Detailed Performance Metrics:');
    console.log(`   Executions: ${detailedMetrics.executions.total}`);
    console.log(
      `   Success Rate: ${(detailedMetrics.executions.successRate * 100).toFixed(2)}%`
    );
    console.log(
      `   Avg Duration: ${detailedMetrics.performance.averageDuration.toFixed(2)}ms`
    );
    console.log(
      `   P95 Duration: ${detailedMetrics.performance.p95Duration.toFixed(2)}ms`
    );
  }

  // Perform health check
  console.log('\n🏥 Health Check:');
  const health = await runtime.healthCheck();
  console.log(`   Overall Status: ${health.status.toUpperCase()}`);
  console.log(`   Uptime: ${Math.floor(health.uptime / 1000)}s`);

  if (health.components.llmProvider) {
    console.log(
      `   LLM Provider: ${health.components.llmProvider.status} (${health.components.llmProvider.latencyMs}ms)`
    );
  }
  if (health.components.memory) {
    console.log(`   Memory: ${health.components.memory.status}`);
  }
}

/**
 * Example 4: Retry Logic and Circuit Breaker
 */
async function demonstrateRetryAndCircuitBreaker(runtime: AgentRuntime) {
  console.log('\n=== Example 4: Retry Logic and Circuit Breaker ===\n');

  // Test retry logic with unreliable operation
  console.log('Testing retry logic with unreliable operation...\n');

  try {
    const result = await runtime.execute(
      'production-agent',
      'Execute unreliable operation with 30% failure rate',
      { sessionId: 'retry-demo' }
    );
    console.log('✅ Operation succeeded (possibly after retries)');
  } catch (error) {
    console.log('❌ Operation failed after all retries:', (error as Error).message);
  }

  // Check circuit breaker status
  console.log('\n🔌 Circuit Breaker Status:');
  const cbStatus = runtime.getCircuitBreakerStatus();
  console.log(`   Enabled: ${cbStatus.enabled}`);
  console.log(`   State: ${cbStatus.state}`);
  console.log(`   Failure Count: ${cbStatus.failureCount}`);
  console.log(`   Success Count: ${cbStatus.successCount}`);
}

/**
 * Example 5: Event Monitoring
 */
async function demonstrateEventMonitoring(runtime: AgentRuntime) {
  console.log('\n=== Example 5: Event Monitoring ===\n');

  // Subscribe to events
  const events: string[] = [];

  runtime.on(AgentEventType.EXECUTION_STARTED, (event) => {
    events.push('EXECUTION_STARTED');
    console.log('📢 Event: Execution started');
  });

  runtime.on(AgentEventType.EXECUTION_COMPLETED, (event) => {
    events.push('EXECUTION_COMPLETED');
    console.log('📢 Event: Execution completed');
  });

  runtime.on(AgentEventType.TOOL_EXECUTION_STARTED, (event) => {
    events.push('TOOL_EXECUTION_STARTED');
    console.log(`📢 Event: Tool execution started - ${event.toolName}`);
  });

  runtime.on(AgentEventType.TOOL_EXECUTION_COMPLETED, (event) => {
    events.push('TOOL_EXECUTION_COMPLETED');
    console.log(`📢 Event: Tool execution completed - ${event.toolName}`);
  });

  // Execute operation to trigger events
  console.log('\nExecuting operation to trigger events...\n');
  await runtime.execute(
    'production-agent',
    'Get system status',
    { sessionId: 'event-demo' }
  );

  console.log(`\n✅ Captured ${events.length} events`);
}

/**
 * Example 6: Production Monitoring Dashboard
 */
async function productionMonitoringDashboard(runtime: AgentRuntime) {
  console.log('\n=== Example 6: Production Monitoring Dashboard ===\n');

  const metrics = runtime.getMetrics();
  const health = await runtime.healthCheck();
  const rateLimiter = runtime.getRateLimiterStatus();
  const circuitBreaker = runtime.getCircuitBreakerStatus();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PRODUCTION MONITORING DASHBOARD                   ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ HEALTH STATUS                                              ║');
  console.log(`║   Overall: ${health.status.toUpperCase().padEnd(48)} ║`);
  console.log(`║   Uptime: ${Math.floor(health.uptime / 1000)}s`.padEnd(60) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  if (metrics) {
    console.log('║ PERFORMANCE METRICS                                        ║');
    console.log(
      `║   Total Executions: ${metrics.executions.total}`.padEnd(60) + '║'
    );
    console.log(
      `║   Success Rate: ${(metrics.executions.successRate * 100).toFixed(2)}%`.padEnd(
        60
      ) + '║'
    );
    console.log(
      `║   Avg Duration: ${metrics.performance.averageDuration.toFixed(2)}ms`.padEnd(
        60
      ) + '║'
    );
    console.log(
      `║   P95 Duration: ${metrics.performance.p95Duration.toFixed(2)}ms`.padEnd(
        60
      ) + '║'
    );
    console.log('╠════════════════════════════════════════════════════════════╣');
  }

  console.log('║ RATE LIMITER                                               ║');
  console.log(`║   Enabled: ${rateLimiter.enabled}`.padEnd(60) + '║');
  if (rateLimiter.availableTokens !== undefined) {
    console.log(
      `║   Available Tokens: ${rateLimiter.availableTokens}`.padEnd(60) + '║'
    );
  }
  console.log('╠════════════════════════════════════════════════════════════╣');

  console.log('║ CIRCUIT BREAKER                                            ║');
  console.log(`║   State: ${circuitBreaker.state}`.padEnd(60) + '║');
  console.log(
    `║   Failures: ${circuitBreaker.failureCount}`.padEnd(60) + '║'
  );
  console.log('╚════════════════════════════════════════════════════════════╝');
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     @hazeljs/agent - Production Features Demo             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Initialize runtime
    const runtime = await basicProductionSetup();

    // Run demonstrations
    await demonstrateRateLimiting(runtime);
    await demonstrateMetricsAndHealth(runtime);
    await demonstrateRetryAndCircuitBreaker(runtime);
    await demonstrateEventMonitoring(runtime);
    await productionMonitoringDashboard(runtime);

    console.log('\n✅ All production features demonstrated successfully!\n');
    console.log('📚 For more information, see:');
    console.log('   - PRODUCTION_READINESS.md');
    console.log('   - packages/agent/src/utils/');
    console.log('   - packages/agent/tests/utils/\n');
  } catch (error) {
    console.error('❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicProductionSetup,
  demonstrateRateLimiting,
  demonstrateMetricsAndHealth,
  demonstrateRetryAndCircuitBreaker,
  demonstrateEventMonitoring,
  productionMonitoringDashboard,
};
