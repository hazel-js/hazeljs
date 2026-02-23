# HazelJS AI Module

Production-ready AI integration for HazelJS with support for multiple providers.

## Features

- ✅ **Multi-Provider Support** - OpenAI, Anthropic, Gemini, Cohere
- ✅ **Context Management** - Handle long conversations efficiently
- ✅ **Token Tracking** - Monitor usage and costs
- ✅ **Rate Limiting** - Prevent abuse and control costs
- ✅ **Caching** - Reduce API calls and costs
- ✅ **Retry Logic** - Automatic retries with exponential backoff
- ✅ **Streaming** - Real-time response streaming
- ✅ **Type-Safe** - Full TypeScript support

## Quick Start

### Installation

```bash
npm install @hazeljs/core openai
```

### Basic Usage

```typescript
import { Injectable } from '@hazeljs/core';
import { AIEnhancedService } from '@hazeljs/core/ai';

@Injectable()
export class ChatService {
  constructor(private ai: AIEnhancedService) {}

  async chat(message: string): Promise<string> {
    const response = await this.ai.complete({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: message },
      ],
      model: 'gpt-4-turbo-preview',
    });

    return response.content;
  }
}
```

### With Caching and Rate Limiting

```typescript
async chatWithUser(userId: string, message: string): Promise<string> {
  const response = await this.ai.complete(
    {
      messages: [{ role: 'user', content: message }],
      model: 'gpt-4-turbo-preview',
    },
    {
      userId: userId,
      cacheKey: `chat:${userId}:${message}`,
      cacheTTL: 3600, // 1 hour
    }
  );

  return response.content;
}
```

### Streaming

```typescript
async *streamChat(message: string): AsyncGenerator<string> {
  for await (const chunk of this.ai.streamComplete({
    messages: [{ role: 'user', content: message }],
  })) {
    yield chunk.delta;
  }
}
```

### Context Management

```typescript
import { AIContextManager } from '@hazeljs/core/ai';

const context = new AIContextManager(4096);

// Add messages
context.addSystemMessage('You are a helpful assistant.');
context.addUserMessage('Hello!');
context.addAssistantMessage('Hi! How can I help?');

// Get all messages for API call
const messages = context.getMessages();

// Auto-trims when exceeding token limit
context.addUserMessage('Very long message...');
```

### Token Tracking

```typescript
import { TokenTracker } from '@hazeljs/core/ai';

const tracker = new TokenTracker({
  maxTokensPerRequest: 4096,
  maxTokensPerDay: 100000,
  maxTokensPerMonth: 1000000,
});

// Check limits before API call
const check = await tracker.checkLimits('user123', 1000);
if (!check.allowed) {
  throw new Error(check.reason);
}

// Track usage after API call
tracker.track({
  userId: 'user123',
  promptTokens: 100,
  completionTokens: 200,
  totalTokens: 300,
  timestamp: Date.now(),
}, 'gpt-4-turbo-preview');

// Get statistics
const stats = tracker.getUserStats('user123', 30); // Last 30 days
console.log(stats);
// {
//   totalTokens: 50000,
//   totalCost: 1.50,
//   requestCount: 100,
//   averageTokensPerRequest: 500,
//   dailyAverage: 1666
// }
```

## Supported Providers

### OpenAI

```typescript
import { OpenAIProvider } from '@hazeljs/core/ai';

const provider = new OpenAIProvider(process.env.OPENAI_API_KEY);
```

**Models:**
- `gpt-4-turbo-preview`
- `gpt-4`
- `gpt-3.5-turbo`
- `text-embedding-3-small`
- `text-embedding-3-large`

### Anthropic

```typescript
import { AnthropicProvider } from '@hazeljs/core/ai';

const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
```

**Models:**
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

### Google Gemini

```typescript
import { GeminiProvider } from '@hazeljs/core/ai';

const provider = new GeminiProvider(process.env.GEMINI_API_KEY);
```

**Models:**
- `gemini-pro`
- `gemini-pro-vision`

### Cohere

```typescript
import { CohereProvider } from '@hazeljs/core/ai';

const provider = new CohereProvider(process.env.COHERE_API_KEY);
```

**Models:**
- `command`
- `command-light`
- `embed-english-v3.0`

## Decorators

### @AITask

```typescript
import { Controller, Post, Body } from '@hazeljs/core';
import { AITask } from '@hazeljs/core/ai';

@Controller('/ai')
export class AIController {
  @Post('/summarize')
  @AITask({
    name: 'summarize',
    prompt: 'Summarize: {{input}}',
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    outputType: 'string',
  })
  async summarize(@Body() data: { text: string }) {
    return data.text;
  }
}
```

### @AIFunction

```typescript
import { AIFunction, AIPrompt } from '@hazeljs/core/ai';

@Injectable()
export class WeatherService {
  @AIFunction({
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
  })
  async getWeather(@AIPrompt() location: string) {
    return { temperature: 72, condition: 'sunny' };
  }
}
```

## Configuration

### Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GEMINI_API_KEY=...

# Cohere
COHERE_API_KEY=...
```

### Service Configuration

```typescript
// Set default provider
ai.setDefaultProvider('anthropic');

// Configure retry logic
ai.setRetryConfig(5, 2000); // 5 attempts, 2s initial delay

// Register custom provider
ai.registerProvider(myCustomProvider);
```

## Cost Optimization

### 1. Use Caching

```typescript
// Cache responses for 1 hour
const response = await ai.complete(request, {
  cacheKey: `prompt:${hash}`,
  cacheTTL: 3600,
});
```

### 2. Use Cheaper Models

```typescript
// Use GPT-3.5 for simple tasks
model: 'gpt-3.5-turbo'  // $0.0005 per 1K tokens

// Use GPT-4 for complex tasks
model: 'gpt-4-turbo-preview'  // $0.01 per 1K tokens
```

### 3. Implement Rate Limiting

```typescript
const tracker = new TokenTracker({
  maxTokensPerDay: 50000,  // Limit daily usage
  maxTokensPerMonth: 500000,
});
```

### 4. Optimize Prompts

```typescript
// Bad: Verbose prompt
"Please analyze the following text and provide a detailed summary..."

// Good: Concise prompt
"Summarize: {{text}}"
```

## Production Best Practices

### 1. Error Handling

```typescript
try {
  const response = await ai.complete(request);
  return response.content;
} catch (error) {
  logger.error('AI request failed:', error);
  // Fallback logic
  return 'Sorry, I encountered an error.';
}
```

### 2. Monitoring

```typescript
// Track usage
const stats = ai.getTokenStats();
logger.info('AI Usage:', stats);

// Set up alerts
if (stats.totalCost > 100) {
  alert('High AI costs detected!');
}
```

### 3. Testing

```typescript
// Mock AI service in tests
const mockAI = {
  complete: jest.fn().mockResolvedValue({
    content: 'Mock response',
  }),
};
```

## API Reference

See full documentation at: https://hazeljs.com/docs/ai

## Examples

- [Chat Application](../../examples/ai-chat)
- [Content Generation](../../examples/ai-content)
- [RAG System](../../examples/ai-rag)
- [Function Calling](../../examples/ai-functions)

## License

Apache 2.0
