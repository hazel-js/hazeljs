/**
 * Agent Context Builder
 * Builds execution context with memory and RAG integration
 */

import { AgentContext } from '../types/agent.types';
import { MemoryManager, Message, Entity } from '@hazeljs/rag';

/**
 * Agent Context Builder
 * Prepares context for agent execution
 */
export class AgentContextBuilder {
  constructor(private memoryManager?: MemoryManager) {}

  /**
   * Build context with memory
   */
  async buildWithMemory(context: AgentContext, maxHistory: number = 20): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    const history = await this.memoryManager.getConversationHistory(context.sessionId, maxHistory);

    context.memory.conversationHistory = history.map((msg: Message) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || new Date(),
    }));

    const entities = await this.memoryManager.getAllEntities(context.sessionId);
    context.memory.entities = entities.map((entity: Entity) => ({
      name: entity.name,
      type: entity.type,
      attributes: entity.attributes,
    }));

    const workingMemoryKeys = ['current_task', 'user_preferences', 'session_state'];
    for (const key of workingMemoryKeys) {
      const value = await this.memoryManager.getContext(key, context.sessionId);
      if (value !== null) {
        context.memory.workingMemory[key] = value;
      }
    }
  }

  /**
   * Build context with RAG
   */
  async buildWithRAG(
    context: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ragService: any,
    topK: number = 5
  ): Promise<void> {
    if (!ragService) {
      return;
    }

    try {
      const results = await ragService.search(context.input, { topK });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context.ragContext = results.map((r: any) => r.content || r.text);
    } catch {
      context.ragContext = [];
    }
  }

  /**
   * Persist context to memory
   */
  async persistToMemory(context: AgentContext): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    for (const msg of context.memory.conversationHistory) {
      await this.memoryManager.addMessage(
        {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp,
        },
        context.sessionId,
        context.userId
      );
    }

    for (const [key, value] of Object.entries(context.memory.workingMemory)) {
      await this.memoryManager.setContext(key, value, context.sessionId);
    }

    for (const entity of context.memory.entities) {
      const existingEntity = await this.memoryManager.getEntity(entity.name);
      if (existingEntity) {
        await this.memoryManager.updateEntity(entity.name, entity);
      } else {
        await this.memoryManager.trackEntity(
          {
            name: entity.name,
            type: entity.type,
            attributes: entity.attributes,
            relationships: [],
            firstSeen: new Date(),
            lastSeen: new Date(),
            mentions: 1,
          },
          context.sessionId
        );
      }
    }
  }
}
