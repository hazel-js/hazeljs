import { AIContext, AIMessage } from '../ai-enhanced.types';
import logger from '@hazeljs/core';

/**
 * AI Context Manager
 * Manages conversation context and token limits
 */
export class AIContextManager implements AIContext {
  messages: AIMessage[] = [];
  maxTokens: number;
  currentTokens: number = 0;
  private readonly TOKENS_PER_MESSAGE = 4; // Approximate overhead per message
  private readonly TOKENS_PER_NAME = 1; // Approximate overhead for name field

  constructor(maxTokens: number = 4096) {
    this.maxTokens = maxTokens;
    logger.debug(`AI Context Manager initialized with max tokens: ${maxTokens}`);
  }

  /**
   * Add message to context
   */
  addMessage(message: AIMessage): void {
    const tokens = this.estimateTokens(message);
    this.messages.push(message);
    this.currentTokens += tokens;

    logger.debug(`Message added to context`, {
      role: message.role,
      tokens,
      totalTokens: this.currentTokens,
    });

    // Auto-trim if exceeds limit
    if (this.currentTokens > this.maxTokens) {
      this.trimToLimit();
    }
  }

  /**
   * Get all messages
   */
  getMessages(): AIMessage[] {
    return [...this.messages];
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
    this.currentTokens = 0;
    logger.debug('Context cleared');
  }

  /**
   * Trim messages to fit within token limit
   * Keeps system messages and removes oldest user/assistant messages
   */
  trimToLimit(): void {
    logger.debug('Trimming context to fit token limit');

    // Separate system messages from conversation messages
    const systemMessages = this.messages.filter((m) => m.role === 'system');
    const conversationMessages = this.messages.filter((m) => m.role !== 'system');

    // Calculate tokens for system messages
    const systemTokens = systemMessages.reduce((sum, msg) => sum + this.estimateTokens(msg), 0);

    // Available tokens for conversation
    const availableTokens = this.maxTokens - systemTokens;

    // Keep most recent messages that fit
    const keptMessages: AIMessage[] = [];
    let conversationTokens = 0;

    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const tokens = this.estimateTokens(msg);

      if (conversationTokens + tokens <= availableTokens) {
        keptMessages.unshift(msg);
        conversationTokens += tokens;
      } else {
        break;
      }
    }

    // Combine system messages with kept conversation messages
    this.messages = [...systemMessages, ...keptMessages];
    this.currentTokens = systemTokens + conversationTokens;

    logger.debug('Context trimmed', {
      removedMessages: conversationMessages.length - keptMessages.length,
      remainingMessages: this.messages.length,
      currentTokens: this.currentTokens,
    });
  }

  /**
   * Estimate tokens for a message
   * This is a rough estimation. For accurate counting, use tiktoken library
   */
  private estimateTokens(message: AIMessage): number {
    let tokens = this.TOKENS_PER_MESSAGE;

    // Add tokens for content (rough estimate: 1 token ≈ 4 characters)
    tokens += Math.ceil(message.content.length / 4);

    // Add tokens for name if present
    if (message.name) {
      tokens += this.TOKENS_PER_NAME;
    }

    // Add tokens for function call if present
    if (message.functionCall) {
      tokens += Math.ceil(message.functionCall.name.length / 4);
      tokens += Math.ceil(message.functionCall.arguments.length / 4);
    }

    return tokens;
  }

  /**
   * Get context statistics
   */
  getStats(): {
    messageCount: number;
    currentTokens: number;
    maxTokens: number;
    utilizationPercent: number;
  } {
    return {
      messageCount: this.messages.length,
      currentTokens: this.currentTokens,
      maxTokens: this.maxTokens,
      utilizationPercent: Math.round((this.currentTokens / this.maxTokens) * 100),
    };
  }

  /**
   * Set max tokens limit
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
    logger.debug(`Max tokens updated to: ${maxTokens}`);

    if (this.currentTokens > maxTokens) {
      this.trimToLimit();
    }
  }

  /**
   * Get system messages
   */
  getSystemMessages(): AIMessage[] {
    return this.messages.filter((m) => m.role === 'system');
  }

  /**
   * Get conversation messages (user + assistant)
   */
  getConversationMessages(): AIMessage[] {
    return this.messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  }

  /**
   * Add system message
   */
  addSystemMessage(content: string): void {
    this.addMessage({
      role: 'system',
      content,
    });
  }

  /**
   * Add user message
   */
  addUserMessage(content: string): void {
    this.addMessage({
      role: 'user',
      content,
    });
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(content: string): void {
    this.addMessage({
      role: 'assistant',
      content,
    });
  }
}
