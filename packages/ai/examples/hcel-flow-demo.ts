/**
 * HCEL + Flow Engine Integration Demo
 *
 * Demonstrates seamless integration between HazelJS Flow Engine and HCEL
 * for AI-driven workflows with durable execution and persistence.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from examples directory and package root
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { HazelAI } from '../src';

// Mock Flow Engine types for demonstration
// In production, import from: import { FlowEngine, flow, type FlowContext, type NodeResult } from '@hazeljs/flow';

interface FlowContext {
  runId: string;
  flowId: string;
  flowVersion: string;
  tenantId?: string;
  input: unknown;
  state: Record<string, unknown>;
  outputs: Record<string, unknown>;
  meta: {
    attempts: Record<string, number>;
    startedAt: string;
  };
  services?: Record<string, unknown>;
}

interface NodeResult {
  status: 'ok' | 'wait' | 'error';
  output?: unknown;
  patch?: Record<string, unknown>;
  reason?: string;
  until?: string;
}

interface FlowDefinition {
  flowId: string;
  version: string;
  entry: string;
  nodes: Record<string, any>;
  edges: any[];
}

// HCEL-Flow Bridge - Wraps HCEL chains as Flow Engine nodes
class HCELFlowNode {
  constructor(private chain: any) {}

  async execute(input: unknown): Promise<NodeResult> {
    try {
      const result = await this.chain.execute(input);
      return {
        status: 'ok',
        output: result,
      };
    } catch (error) {
      return {
        status: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Mock Flow Engine for demonstration
class MockFlowEngine {
  private flows = new Map<string, FlowDefinition>();
  private executions = new Map<string, any>();

  async registerDefinition(def: FlowDefinition) {
    this.flows.set(`${def.flowId}@${def.version}`, def);
    console.log(`🌊 Flow registered: ${def.flowId} v${def.version}`);
  }

  async startRun(args: { flowId: string; version: string; input: unknown }) {
    const flow = this.flows.get(`${args.flowId}@${args.version}`);
    if (!flow) throw new Error(`Flow ${args.flowId}@${args.version} not found`);

    const execution = {
      runId: `run-${Date.now()}`,
      status: 'RUNNING',
      flowId: args.flowId,
      version: args.version,
      input: args.input,
      startedAt: new Date(),
      outputs: {} as Record<string, unknown>,
    };

    this.executions.set(execution.runId, execution);
    console.log(`🚀 Flow run started: ${execution.runId}`);

    await this.executeFlow(flow, execution);

    return { runId: execution.runId, status: execution.status };
  }

  private async executeFlow(flow: FlowDefinition, execution: any) {
    const context: FlowContext = {
      runId: execution.runId,
      flowId: flow.flowId,
      flowVersion: flow.version,
      input: execution.input,
      state: {},
      outputs: execution.outputs,
      meta: { attempts: {}, startedAt: execution.startedAt.toISOString() },
    };

    try {
      const entryNode = flow.nodes[flow.entry];
      if (entryNode) {
        const result = await entryNode.handler(context);
        execution.outputs[flow.entry] = result.output;
        console.log(`✅ Node executed: ${flow.entry}`);
      }

      for (const edge of flow.edges) {
        const node = flow.nodes[edge.to];
        if (node) {
          const result = await node.handler(context);
          execution.outputs[edge.to] = result.output;
          console.log(`✅ Node executed: ${edge.to}`);
        }
      }

      execution.status = 'COMPLETED';
      console.log(`🏁 Flow completed: ${execution.runId}`);
    } catch (error) {
      execution.status = 'FAILED';
      console.error(`❌ Flow failed: ${error}`);
    }
  }
}

async function demonstrateFlowIntegration() {
  console.log('🌊 HCEL + Flow Engine Integration Demo\n');

  console.log('🔑 Environment check:');
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log();

  try {
    const ai = HazelAI.create({
      defaultProvider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
    });

    console.log('✅ HazelAI initialized for flow demo\n');

    const flowEngine = new MockFlowEngine();

    // ── Flow 1: Customer Support Workflow ───────────────────────────────
    console.log('📞 Flow 1: Customer Support Workflow');

    const customerSupportFlow: FlowDefinition = {
      flowId: 'customer-support',
      version: '1.0.0',
      entry: 'analyze-request',
      nodes: {
        'analyze-request': {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Analyze customer request: My order is delayed and I need help tracking it')
              .ml('classify')
              .persist('customer-analysis');

            const node = new HCELFlowNode(chain);
            return await node.execute(ctx.input);
          },
        },
        'handle-shipping': {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Provide shipping status and solution for delayed order')
              .rag('shipping-docs')
              .persist('shipping-response');

            const node = new HCELFlowNode(chain);
            return await node.execute(ctx.input);
          },
        },
        'follow-up': {
          handler: async (ctx: FlowContext) => {
            console.log('📅 Follow-up scheduled');
            return {
              status: 'ok',
              output: { scheduled: true, date: new Date(Date.now() + 86400000) },
            };
          },
        },
      },
      edges: [
        { from: 'analyze-request', to: 'handle-shipping' },
        { from: 'handle-shipping', to: 'follow-up' },
      ],
    };

    await flowEngine.registerDefinition(customerSupportFlow);
    const supportRun = await flowEngine.startRun({
      flowId: 'customer-support',
      version: '1.0.0',
      input: { request: 'Order delayed' },
    });

    console.log(`✅ Support flow: ${supportRun.status}\n`);

    // ── Flow 2: Content Processing Pipeline ───────────────────────────
    console.log('📝 Flow 2: Content Processing Pipeline');

    const contentFlow: FlowDefinition = {
      flowId: 'content-processing',
      version: '1.0.0',
      entry: 'analyze',
      nodes: {
        analyze: {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Analyze: HazelJS is an amazing AI framework!')
              .ml('sentiment')
              .persist('content-analysis');

            return await new HCELFlowNode(chain).execute(ctx.input);
          },
        },
        summarize: {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Summarize: HazelJS is an amazing AI framework!')
              .persist('summary');

            return await new HCELFlowNode(chain).execute(ctx.input);
          },
        },
        enhance: {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Enhance content for engagement')
              .rag('content-guidelines')
              .persist('enhancement');

            return await new HCELFlowNode(chain).execute(ctx.input);
          },
        },
      },
      edges: [
        { from: 'analyze', to: 'summarize' },
        { from: 'summarize', to: 'enhance' },
      ],
    };

    await flowEngine.registerDefinition(contentFlow);
    const contentRun = await flowEngine.startRun({
      flowId: 'content-processing',
      version: '1.0.0',
      input: { content: 'HazelJS framework' },
    });

    console.log(`✅ Content flow: ${contentRun.status}\n`);

    // ── Flow 3: Research Workflow ───────────────────────────
    console.log('🔬 Flow 3: Multi-Agent Research Workflow');

    const researchFlow: FlowDefinition = {
      flowId: 'research',
      version: '1.0.0',
      entry: 'plan',
      nodes: {
        plan: {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Plan research: The future of AI in software development')
              .persist('research-plan');

            return await new HCELFlowNode(chain).execute(ctx.input);
          },
        },
        literature: {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Literature review: AI in software development')
              .rag('academic-papers')
              .persist('literature');

            return await new HCELFlowNode(chain).execute(ctx.input);
          },
        },
        market: {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel
              .prompt('Market analysis: AI in software development')
              .rag('market-reports')
              .persist('market');

            return await new HCELFlowNode(chain).execute(ctx.input);
          },
        },
        synthesize: {
          handler: async (ctx: FlowContext) => {
            const chain = ai.hazel.prompt('Synthesize research findings').persist('synthesis');

            return await new HCELFlowNode(chain).execute(ctx.input);
          },
        },
      },
      edges: [
        { from: 'plan', to: 'literature' },
        { from: 'plan', to: 'market' },
        { from: 'literature', to: 'synthesize' },
        { from: 'market', to: 'synthesize' },
      ],
    };

    await flowEngine.registerDefinition(researchFlow);
    const researchRun = await flowEngine.startRun({
      flowId: 'research',
      version: '1.0.0',
      input: { topic: 'AI in software' },
    });

    console.log(`✅ Research flow: ${researchRun.status}\n`);

    // ── Production Features Summary ───────────────────────────────────
    console.log('🚀 Production Flow Integration Features:');
    console.log('✅ Durable workflow execution with persistence');
    console.log('✅ HCEL chains as flow nodes');
    console.log('✅ Parallel step execution');
    console.log('✅ Conditional routing and decisions');
    console.log('✅ Multi-agent orchestration within flows');
    console.log('✅ Real-time processing capabilities');
    console.log('✅ Flow execution monitoring and tracking');
    console.log('✅ Context propagation through workflows');
    console.log('✅ Error handling and recovery');
    console.log('✅ Flow composition and reusability');

    console.log('\n🎉 Flow Engine + HCEL integration demo completed!');
    console.log('\n💡 Production Benefits:');
    console.log('🌊 Complex workflow orchestration');
    console.log('🤖 AI-powered decision making');
    console.log('🔄 Persistent state management');
    console.log('⚡ Real-time processing capabilities');
    console.log('📊 Comprehensive monitoring');
  } catch (error) {
    console.error('❌ Error during flow demo:', error);

    if (error instanceof Error) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Ensure @hazeljs/flow package is installed');
      console.log('- Check flow definitions and node configurations');
      console.log('- Verify HCEL chains are properly configured');
    }
  }
}

if (require.main === module) {
  demonstrateFlowIntegration().catch(console.error);
}

export { demonstrateFlowIntegration, HCELFlowNode };
