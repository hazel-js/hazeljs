/**
 * Factory to create a fully configured Ops Agent runtime.
 * Wires together @hazeljs/ai, @hazeljs/agent, @hazeljs/rag.
 */

import { AgentRuntime, createLLMProviderFromAI } from '@hazeljs/agent';
import { MemoryManager, BufferMemory } from '@hazeljs/rag';
import { OpsAgent } from './ops-agent';
import type { CreateOpsRuntimeOptions } from './types';

/**
 * Create an AgentRuntime configured with the Ops Agent.
 * Use this when you want the AI-powered ops assistant with Jira and Slack tools.
 *
 * Memory: If memoryManager is not provided, uses an in-memory BufferMemory by default.
 * Pass a custom MemoryManager for persistent memory.
 */
export function createOpsRuntime(options: CreateOpsRuntimeOptions): AgentRuntime {
  const llmProvider = createLLMProviderFromAI(options.aiService, {
    model: options.model ?? 'gpt-4',
  });

  const agent = new OpsAgent(options.tools);

  const memoryManager =
    options.memoryManager ??
    new MemoryManager(new BufferMemory({ maxSize: 50 }), {
      maxConversationLength: 20,
      entityExtraction: true,
      importanceScoring: true,
    });

  const runtime = new AgentRuntime({
    llmProvider,
    memoryManager: memoryManager as never,
    ragService: options.ragService as never,
    defaultMaxSteps: 12,
    enableObservability: true,
  });

  runtime.registerAgent(OpsAgent as never);
  runtime.registerAgentInstance('ops-agent', agent);

  return runtime;
}

/**
 * Run the ops agent for a single request (convenience method).
 */
export async function runOpsAgent(
  runtime: AgentRuntime,
  input: {
    input: string;
    sessionId?: string;
    userId?: string;
  }
): Promise<{ response: string; steps: number; duration: number }> {
  const sessionId = input.sessionId ?? `ops-${Date.now()}`;

  const result = await runtime.execute('ops-agent', input.input, {
    sessionId,
    userId: input.userId,
    enableMemory: true,
  });

  return {
    response: result.response ?? 'No response',
    steps: result.steps.length,
    duration: result.duration ?? 0,
  };
}
