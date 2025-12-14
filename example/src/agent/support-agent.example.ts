/**
 * Example: Customer Support Agent
 * Demonstrates a complete agent with tools, memory, and approval workflow
 */

import { Agent, Tool, AgentRuntime, AgentEventType } from '@hazeljs/agent';
import { MemoryManager, BufferMemory } from '@hazeljs/rag';
import { OpenAIProvider } from '@hazeljs/ai';

class OrderService {
  async findById(orderId: string) {
    return {
      id: orderId,
      status: 'shipped',
      items: [{ name: 'Product A', quantity: 2 }],
      total: 99.99,
      shippingAddress: '123 Main St',
      trackingNumber: 'TRACK123',
      estimatedDelivery: new Date(),
    };
  }

  async updateAddress(orderId: string, newAddress: any) {
    return {
      id: orderId,
      shippingAddress: newAddress,
    };
  }
}

class InventoryService {
  async check(productId: string) {
    return {
      quantity: 10,
      nextRestock: new Date(),
    };
  }
}

class RefundService {
  async process(data: any) {
    return {
      id: 'REF-' + Date.now(),
      amount: data.amount,
      status: 'pending',
    };
  }
}

@Agent({
  name: 'support-agent',
  description: 'AI-powered customer support agent',
  systemPrompt: `You are a helpful customer support agent for an e-commerce platform.
You can look up orders, check inventory, and process refunds.
Always be polite and professional. If you need to process a refund, explain why.`,
  enableMemory: true,
  maxSteps: 15,
  temperature: 0.7,
})
export class SupportAgent {
  constructor(
    private orderService: OrderService,
    private inventoryService: InventoryService,
    private refundService: RefundService
  ) {}

  @Tool({
    description: 'Look up order information by order ID',
    parameters: [
      {
        name: 'orderId',
        type: 'string',
        description: 'The order ID to lookup (format: ORD-XXXXX)',
        required: true,
      },
    ],
  })
  async lookupOrder(input: { orderId: string }) {
    const order = await this.orderService.findById(input.orderId);
    
    if (!order) {
      return {
        found: false,
        message: `Order ${input.orderId} not found`,
      };
    }

    return {
      found: true,
      orderId: order.id,
      status: order.status,
      items: order.items,
      total: order.total,
      shippingAddress: order.shippingAddress,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: order.estimatedDelivery,
    };
  }

  @Tool({
    description: 'Check product inventory and availability',
    parameters: [
      {
        name: 'productId',
        type: 'string',
        description: 'The product ID to check',
        required: true,
      },
    ],
  })
  async checkInventory(input: { productId: string }) {
    const inventory = await this.inventoryService.check(input.productId);
    
    return {
      productId: input.productId,
      inStock: inventory.quantity > 0,
      quantity: inventory.quantity,
      availableDate: inventory.nextRestock,
    };
  }

  @Tool({
    description: 'Process a refund for an order',
    requiresApproval: true,
    timeout: 60000,
    parameters: [
      {
        name: 'orderId',
        type: 'string',
        description: 'The order ID to refund',
        required: true,
      },
      {
        name: 'amount',
        type: 'number',
        description: 'Refund amount in dollars',
        required: true,
      },
      {
        name: 'reason',
        type: 'string',
        description: 'Reason for refund',
        required: true,
      },
    ],
  })
  async processRefund(input: { orderId: string; amount: number; reason: string }) {
    const refund = await this.refundService.process({
      orderId: input.orderId,
      amount: input.amount,
      reason: input.reason,
    });

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      estimatedProcessingDays: 5,
    };
  }

  @Tool({
    description: 'Update shipping address for an order',
    requiresApproval: true,
    parameters: [
      {
        name: 'orderId',
        type: 'string',
        description: 'The order ID',
        required: true,
      },
      {
        name: 'newAddress',
        type: 'object',
        description: 'New shipping address',
        required: true,
      },
    ],
  })
  async updateShippingAddress(input: { orderId: string; newAddress: any }) {
    const updated = await this.orderService.updateAddress(
      input.orderId,
      input.newAddress
    );

    return {
      success: true,
      orderId: input.orderId,
      newAddress: updated.shippingAddress,
    };
  }
}

async function main() {
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    console.log('Please set your OpenAI API key:');
    console.log('  export OPENAI_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  const memoryStore = new BufferMemory({ maxSize: 100 });
  const memoryManager = new MemoryManager(memoryStore);
  
  // Initialize OpenAI provider
  const openaiProvider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
    defaultModel: 'gpt-4-turbo-preview'
  });

  // Create adapter for agent runtime
  const llmAdapter = {
    async chat(options: any) {
      // Map tools to OpenAI function format
      const functions = options.tools?.map((tool: any) => {
        // Handle both formats: tool.function or tool directly
        const toolDef = tool.function || tool;
        return {
          name: toolDef.name,
          description: toolDef.description,
          parameters: toolDef.parameters,
        };
      });

      const response = await openaiProvider.complete({
        messages: options.messages,
        temperature: 0.7,
        functions: functions && functions.length > 0 ? functions : undefined,
      });

      return {
        content: response.content,
        tool_calls: response.functionCall ? [{
          id: response.id,
          type: 'function' as const,
          function: {
            name: response.functionCall.name,
            arguments: response.functionCall.arguments,
          },
        }] : [],
      };
    },
  };

  const runtime = new AgentRuntime({
    memoryManager,
    llmProvider: llmAdapter,
    defaultMaxSteps: 15,
    enableObservability: true,
  });

  const orderService = new OrderService();
  const inventoryService = new InventoryService();
  const refundService = new RefundService();

  const supportAgent = new SupportAgent(
    orderService,
    inventoryService,
    refundService
  );

  runtime.registerAgent(SupportAgent);
  runtime.registerAgentInstance('support-agent', supportAgent);

  runtime.on(AgentEventType.TOOL_APPROVAL_REQUESTED, async (event) => {
    console.log('\n🔔 Approval Required:');
    console.log('Tool:', event.data.toolName);
    console.log('Input:', event.data.input);
    console.log('\nWaiting for approval...');
    
    setTimeout(() => {
      runtime.approveToolExecution(event.data.requestId, 'supervisor-123');
      console.log('✅ Approved by supervisor\n');
    }, 2000);
  });

  runtime.onAny((event) => {
    console.log(`[${event.type}]`, event.data);
  });

  console.log('🤖 Starting Support Agent...\n');

  const result = await runtime.execute(
    'support-agent',
    'I need to check the status of my order ORD-12345',
    {
      sessionId: 'customer-session-789',
      userId: 'customer-456',
      enableMemory: true,
    }
  );

  console.log('\n✅ Agent Response:');
  console.log(result.response);
  console.log(`\nCompleted in ${result.steps.length} steps`);
  console.log(`Duration: ${result.duration}ms`);
}

if (require.main === module) {
  main().catch(console.error);
}
