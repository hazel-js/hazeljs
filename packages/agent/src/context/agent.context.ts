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
    topK: number = 5,
    onError?: (error: Error) => void,
    freshnessOpts?: { maxAgeMs?: number; minConfidence?: number }
  ): Promise<void> {
    if (!ragService) {
      return;
    }

    try {
      const results = await ragService.search(context.input, { topK });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context.ragContext = results.map((r: any) => r.content || r.text);

      const { assessKnowledgeFreshness } = await import('../knowledge/knowledge-freshness');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs = (results as any[]).map((r) => ({
        id: r.id ?? r.documentId,
        content: r.content || r.text,
        updatedAt: r.updatedAt ?? r.metadata?.updatedAt ?? r.metadata?.indexedAt,
        expiresAt: r.expiresAt ?? r.metadata?.expiresAt,
        confidence: r.score ?? r.confidence ?? r.metadata?.confidence,
        metadata: r.metadata,
      }));
      const freshness = assessKnowledgeFreshness(docs, freshnessOpts);
      context.metadata = {
        ...context.metadata,
        knowledgeFreshness: freshness,
      };
      if (
        freshness.stale &&
        freshness.recommendation === 're_fetch' &&
        typeof ragService.reindex === 'function'
      ) {
        // Best-effort refresh hook when the RAG service exposes reindex
        try {
          await ragService.reindex({
            ids: freshness.staleDocuments.map((d) => d.id).filter(Boolean),
          });
        } catch {
          // ignore reindex failures — freshness report still surfaces to callers
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      context.ragContext = [];
    }
  }

  /**
   * Build context with Cache-Augmented Generation (duck-typed CagService port).
   */
  async buildWithCAG(
    context: AgentContext,
    cagService: {
      getContext(input: {
        namespace: string;
        tenantId: string;
        agentId?: string;
      }): Promise<{ context: { text: string }; hit?: boolean }>;
    },
    options?: { namespace?: string; tenantId?: string; onError?: (error: Error) => void }
  ): Promise<void> {
    if (!cagService) return;
    try {
      const tenantId =
        options?.tenantId ??
        (typeof context.metadata?.tenantId === 'string' ? context.metadata.tenantId : undefined) ??
        context.userId ??
        'default';
      const result = await cagService.getContext({
        namespace: options?.namespace ?? 'default',
        tenantId,
        agentId: context.agentId,
      });
      context.cagContext = [result.context.text];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      options?.onError?.(err);
      context.cagContext = [];
    }
  }

  /**
   * Build context with Knowledge-Augmented Generation (duck-typed KagService port).
   */
  async buildWithKAG(
    context: AgentContext,
    kagService: {
      ask(
        question: string,
        options?: { explain?: boolean; tenantId?: string; graph?: string }
      ): Promise<{ answer?: string; explanation?: string; confidence?: number }>;
    },
    options?: { graph?: string; tenantId?: string; onError?: (error: Error) => void }
  ): Promise<void> {
    if (!kagService) return;
    try {
      const tenantId =
        options?.tenantId ??
        (typeof context.metadata?.tenantId === 'string' ? context.metadata.tenantId : undefined) ??
        context.userId ??
        'default';
      const result = await kagService.ask(context.input, {
        explain: true,
        tenantId,
        graph: options?.graph,
      });
      const pieces = [result.answer, result.explanation].filter(
        (p): p is string => typeof p === 'string' && p.length > 0
      );
      context.kagContext = pieces;
      context.metadata = {
        ...context.metadata,
        kagConfidence: result.confidence,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      options?.onError?.(err);
      context.kagContext = [];
    }
  }

  /**
   * Build unified multi-source context (duck-typed @hazeljs/context ContextService).
   */
  async buildWithUnifiedContext(
    context: AgentContext,
    contextService: {
      assemble(request: {
        query: string;
        tenantId: string;
        namespace?: string;
        agentId?: string;
        userId?: string;
        sessionId?: string;
      }): Promise<{
        text: string;
        sourcesUsed?: string[];
        plan?: { rationale?: string[] };
      }>;
    },
    options?: { tenantId?: string; namespace?: string; onError?: (error: Error) => void }
  ): Promise<void> {
    if (!contextService) return;
    try {
      const tenantId =
        options?.tenantId ??
        (typeof context.metadata?.tenantId === 'string' ? context.metadata.tenantId : undefined) ??
        context.userId ??
        'default';
      const result = await contextService.assemble({
        query: context.input,
        tenantId,
        namespace: options?.namespace,
        agentId: context.agentId,
        userId: context.userId,
        sessionId: context.sessionId,
      });
      context.unifiedContext = result.text ? [result.text] : [];
      context.metadata = {
        ...context.metadata,
        contextSourcesUsed: result.sourcesUsed,
        contextPlanRationale: result.plan?.rationale,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      options?.onError?.(err);
      context.unifiedContext = [];
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
