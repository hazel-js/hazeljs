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
 * history and can optionally persist memory using @hazeljs/memory
 * when available.
 */
export class AssistantFacade {
  constructor(
    private aiService: AIEnhancedService,
    private config: HazelAIConfig
  ) {}

  /**
   * Create a new assistant instance.
   *
   * @param assistantConfig Assistant configuration
   * @returns Assistant instance with session management
   */
  create(assistantConfig: AssistantConfig): AssistantInstance {
    const sessionId = randomUUID();
    const history: AIMessage[] = [];

    // Add system prompt if provided
    if (assistantConfig.systemPrompt) {
      history.push({ role: 'system', content: assistantConfig.systemPrompt });
    }

    // TODO: In Phase 2, integrate with @hazeljs/memory for persistent storage
    // based on assistantConfig.memoryStore setting

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

      return {
        content: response.content,
        sessionId,
        usage: response.usage,
      };
    };

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
      },
    };
  }
}
