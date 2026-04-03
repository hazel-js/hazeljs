/**
 * Agent Context Builder
 * Builds execution context with memory and RAG integration
 */
import { AgentContext } from '../types/agent.types';
import { MemoryManager } from '@hazeljs/rag';
/**
 * Agent Context Builder
 * Prepares context for agent execution
 */
export declare class AgentContextBuilder {
    private memoryManager?;
    constructor(memoryManager?: MemoryManager);
    /**
     * Build context with memory
     */
    buildWithMemory(context: AgentContext, maxHistory?: number): Promise<void>;
    /**
     * Build context with RAG
     */
    buildWithRAG(context: AgentContext, ragService: any, topK?: number): Promise<void>;
    /**
     * Persist context to memory
     */
    persistToMemory(context: AgentContext): Promise<void>;
}
//# sourceMappingURL=agent.context.d.ts.map