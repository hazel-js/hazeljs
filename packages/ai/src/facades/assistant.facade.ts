import { AIEnhancedService } from '../ai-enhanced.service';
import type { AIMessage } from '../ai-enhanced.types';
import type {
  HazelAIConfig,
  AssistantConfig,
  AssistantInstance,
  AssistantResponse,
} from '../platform/hazel-ai.types';
import { randomUUID } from 'crypto';

/**
 * Assistant Facade — Provides memory-enabled conversational assistants.
 *
 * This facade creates assistant instances that maintain conversation
 * history and optionally persist memory using @hazeljs/memory
 * when available.
 */
export class AssistantFacade {
  private memoryService: unknown = null;
  private memoryInitialized = false;

  constructor(
    private aiService: AIEnhancedService,
    private config: HazelAIConfig
  ) {}

  /**
   * Ensure @hazeljs/memory is loaded and initialized.
   * Gracefully falls back to in-memory storage if package not available.
   */
  private async ensureMemory(): Promise<void> {
    if (this.memoryInitialized) return;

    const memoryConfig = this.config.persistence?.memory;

    // If no memory config or explicitly set to in-memory, use fallback
    if (!memoryConfig || memoryConfig.store === 'in-memory') {
      this.memoryInitialized = true;
      return;
    }

    try {
      const { MemoryService } = await import('@hazeljs/memory');

      // Create appropriate store based on configuration
      let store;
      if (memoryConfig.store === 'postgres') {
        const { PostgresStore } = await import('@hazeljs/memory');
        // Note: PostgresStore requires a pool, not connectionString
        // For production, users should provide the pool in options
        store = new PostgresStore({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pool: memoryConfig.options?.pool as any, // User must provide the pool
          tableName: memoryConfig.options?.tableName as string,
          ...memoryConfig.options,
        });
      } else if (memoryConfig.store === 'redis') {
        const { RedisStore } = await import('@hazeljs/memory');
        // Note: RedisStore requires a client, not connectionString
        // For production, users should provide the client in options
        store = new RedisStore({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client: memoryConfig.options?.client as any, // User must provide the client
          keyPrefix: memoryConfig.options?.keyPrefix as string,
          defaultTtlSeconds: memoryConfig.ttl,
          ...memoryConfig.options,
        });
      } else {
        throw new Error(`Unsupported memory store: ${memoryConfig.store}`);
      }

      // Initialize memory service
      this.memoryService = new MemoryService(store, {
        defaultEmotionalTtlMs: memoryConfig.ttl ? memoryConfig.ttl * 1000 : undefined,
      });

      await (this.memoryService as { initialize(): Promise<void> }).initialize();
      this.memoryInitialized = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        // eslint-disable-next-line no-console
        console.warn('@hazeljs/memory not available, falling back to in-memory storage');
        this.memoryInitialized = true;
        return;
      }

      // eslint-disable-next-line no-console
      console.error('Failed to initialize persistent memory:', error);
      // Fall back to in-memory storage
      this.memoryInitialized = true;
    }
  }

  /**
   * Create a new assistant instance.
   *
   * @param assistantConfig Assistant configuration
   * @returns Assistant instance with session management
   */
  async create(assistantConfig: AssistantConfig): Promise<AssistantInstance> {
    await this.ensureMemory();

    const sessionId = randomUUID();
    const userId = assistantConfig.options?.userId || 'anonymous';

    // Try to load existing conversation history from memory
    let history: AIMessage[] = [];
    if (this.memoryService && assistantConfig.memory) {
      try {
        const memoryKey = `assistant:${userId}:${sessionId}`;
        const storedHistory = await (
          this.memoryService as {
            get(key: string, type: string): Promise<AIMessage[] | null>;
          }
        ).get(memoryKey, 'conversation');
        if (storedHistory) {
          history = storedHistory;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to load conversation history:', error);
      }
    }

    // Add system prompt if provided (only if not already in history)
    if (assistantConfig.systemPrompt && !history.some((msg) => msg.role === 'system')) {
      history.push({ role: 'system', content: assistantConfig.systemPrompt });
    }

    const chatMethod = async (message: string): Promise<AssistantResponse> => {
      // Add user message to history
      history.push({ role: 'user', content: message });

      // Get response from AI
      const response = await this.aiService.complete(
        {
          messages: [...history],
          model: assistantConfig.model || this.config.model,
          temperature: this.config.temperature,
        },
        {
          provider: assistantConfig.provider || this.config.defaultProvider,
        }
      );

      // Add assistant response to history
      history.push({ role: 'assistant', content: response.content });

      // Save conversation history to memory if enabled
      if (this.memoryService && assistantConfig.memory) {
        try {
          const memoryKey = `assistant:${userId}:${sessionId}`;
          await (
            this.memoryService as {
              set(key: string, type: string, data: AIMessage[]): Promise<void>;
            }
          ).set(memoryKey, 'conversation', history);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save conversation history:', error);
        }
      }

      return {
        content: response.content,
        sessionId,
        usage: response.usage,
      };
    };

    // Store memory service reference for clearHistory
    const memoryServiceRef = this.memoryService;

    return {
      sessionId,
      chat: chatMethod,
      getHistory(): AIMessage[] {
        return [...history];
      },
      clearHistory(): void {
        // Keep system prompt if it exists
        const systemPrompt = history.find((msg) => msg.role === 'system');
        history.length = 0;
        if (systemPrompt) {
          history.push(systemPrompt);
        }

        // Clear from persistent memory if enabled
        if (memoryServiceRef && assistantConfig.memory) {
          try {
            const memoryKey = `assistant:${userId}:${sessionId}`;
            (
              memoryServiceRef as {
                delete(key: string, type: string): Promise<void>;
              }
            ).delete(memoryKey, 'conversation');
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Failed to clear conversation history:', error);
          }
        }
      },
    };
  }
}
