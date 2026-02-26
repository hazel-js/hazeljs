/**
 * Factory to create a fully configured Investigator Agent runtime.
 * Wires together @hazeljs/ai, @hazeljs/agent, @hazeljs/rag, and @hazeljs/riskos.
 */

import { AgentRuntime, createLLMProviderFromAI } from '@hazeljs/agent';
import { MemoryManager, BufferMemory } from '@hazeljs/rag';
import { InvestigatorAgent } from './investigator-agent';
import type { CreateInvestigatorRuntimeOptions } from './types';

/**
 * Create an AgentRuntime configured with the Investigator Agent.
 * Use this when you want the full AI-powered investigator with RiskOS tools.
 *
 * Memory: If `memoryManager` is not provided, uses an in-memory BufferMemory by default
 * so the agent retains conversation history across turns. Pass a custom MemoryManager
 * (e.g. with HybridMemory for production) for persistent memory.
 */
export function createInvestigatorRuntime(options: CreateInvestigatorRuntimeOptions): AgentRuntime {
  const llmProvider = createLLMProviderFromAI(options.aiService, {
    model: options.model ?? 'gpt-4',
  });

  const agent = new InvestigatorAgent(options.tools);

  // Default in-memory memory when none provided (conversation history, entities, context)
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
    defaultMaxSteps: 15,
    enableObservability: true,
  });

  runtime.registerAgent(InvestigatorAgent as never);
  runtime.registerAgentInstance('investigator-agent', agent);

  return runtime;
}

/**
 * Run the investigator agent for a single question (convenience method).
 */
export async function runInvestigator(
  runtime: AgentRuntime,
  input: {
    caseId: string;
    question: string;
    sessionId?: string;
    userId?: string;
    tenantId?: string;
  }
): Promise<{ response: string; steps: number; duration: number }> {
  const sessionId = input.sessionId ?? `investigation-${input.caseId}-${Date.now()}`;

  const result = await runtime.execute(
    'investigator-agent',
    `Case ${input.caseId}: ${input.question}`,
    {
      sessionId,
      userId: input.userId,
      metadata: { caseId: input.caseId, tenantId: input.tenantId },
    }
  );

  return {
    response: result.response ?? 'No response',
    steps: result.steps.length,
    duration: result.duration,
  };
}
