# @hazeljs/ai

**AI Integration Module for HazelJS - OpenAI, Anthropic, Gemini, Cohere, and Ollama Support**

Build AI-powered applications with first-class LLM integration, streaming support, and decorator-based APIs.

[![npm version](https://img.shields.io/npm/v/@hazeljs/ai.svg)](https://www.npmjs.com/package/@hazeljs/ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🤖 **Multiple Providers** - OpenAI, Anthropic, Gemini, Cohere, Ollama
- 🎨 **Decorator-Based API** - `@AITask` decorator for clean integration
- 📡 **Streaming Support** - Real-time response streaming
- 🔄 **Retry Logic** - Automatic retries with exponential backoff
- 💾 **Response Caching** - Built-in caching with @hazeljs/cache
- 🎯 **Type Safety** - Full TypeScript support with output types
- 🔧 **Flexible Configuration** - Per-task or global configuration
- 📊 **Token Tracking** - Monitor usage and costs

## Installation

```bash
npm install @hazeljs/ai
```

### Peer Dependencies

Install the provider(s) you want to use:

```bash
# OpenAI
npm install openai

# Anthropic
npm install @anthropic-ai/sdk

# Google Gemini
npm install @google/generative-ai

# Cohere
npm install cohere-ai

# Ollama (local LLMs)
npm install ollama
```

## Quick Start

### Basic Usage with Decorator

```typescript
import { Injectable } from '@hazeljs/core';
import { AIService, AITask } from '@hazeljs/ai';

@Injectable()
export class ChatService {
  constructor(private aiService: AIService) {}

  @AITask({
    name: 'chat',
    prompt: 'You are a helpful assistant. Respond to: {{input}}',
    provider: 'openai',
    model: 'gpt-4',
    outputType: 'string',
  })
  async chat(message: string): Promise<string> {
    return message; // Decorator handles AI execution
  }
}

// Usage
const response = await chatService.chat('Hello, how are you?');
console.log(response);
```

### Direct AI Service Usage

```typescript
import { AIEnhancedService } from '@hazeljs/ai';

const aiService = new AIEnhancedService();

const response = await aiService.complete({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is TypeScript?' }
  ],
  model: 'gpt-4',
  provider: 'openai',
  temperature: 0.7,
  maxTokens: 500,
});

console.log(response.content);
console.log('Tokens used:', response.usage);
```

## Providers

### OpenAI

```typescript
import { AIEnhancedService } from '@hazeljs/ai';

const aiService = new AIEnhancedService();

// GPT-4
const response = await aiService.complete({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4',
  provider: 'openai',
});

// GPT-3.5 Turbo
const response2 = await aiService.complete({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-3.5-turbo',
  provider: 'openai',
});
```

### Anthropic Claude

```typescript
const response = await aiService.complete({
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
  model: 'claude-3-opus-20240229',
  provider: 'anthropic',
  maxTokens: 1000,
});
```

### Google Gemini

```typescript
const response = await aiService.complete({
  messages: [{ role: 'user', content: 'Write a poem' }],
  model: 'gemini-pro',
  provider: 'gemini',
});
```

### Cohere

```typescript
const response = await aiService.complete({
  messages: [{ role: 'user', content: 'Summarize this text' }],
  model: 'command',
  provider: 'cohere',
});
```

### Ollama (Local LLMs)

```typescript
const response = await aiService.complete({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'llama2',
  provider: 'ollama',
  baseURL: 'http://localhost:11434',
});
```

## Streaming

```typescript
import { AIEnhancedService } from '@hazeljs/ai';

const aiService = new AIEnhancedService();

// Stream responses in real-time
for await (const chunk of aiService.streamComplete({
  messages: [{ role: 'user', content: 'Tell me a long story' }],
  provider: 'openai',
  model: 'gpt-4',
})) {
  process.stdout.write(chunk.delta);
}
```

### Streaming with Decorator

```typescript
@AITask({
  name: 'stream-chat',
  prompt: 'You are a storyteller. Tell a story about: {{topic}}',
  provider: 'openai',
  model: 'gpt-4',
  stream: true,
})
async streamStory(topic: string): AsyncGenerator<string> {
  return topic; // Returns async generator
}

// Usage
for await (const chunk of chatService.streamStory('dragons')) {
  console.log(chunk);
}
```

## Advanced Features

### Response Caching

```typescript
import { AITask } from '@hazeljs/ai';

@AITask({
  name: 'cached-completion',
  prompt: 'Explain {{concept}}',
  provider: 'openai',
  model: 'gpt-4',
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    key: 'explain-{{concept}}',
  },
})
async explainConcept(concept: string): Promise<string> {
  return concept;
}
```

### Retry Logic

```typescript
const response = await aiService.complete({
  messages: [{ role: 'user', content: 'Hello' }],
  provider: 'openai',
  model: 'gpt-4',
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
});
```

### Output Type Validation

```typescript
interface UserProfile {
  name: string;
  age: number;
  interests: string[];
}

@AITask({
  name: 'extract-profile',
  prompt: 'Extract user profile from: {{text}}',
  provider: 'openai',
  model: 'gpt-4',
  outputType: 'json',
})
async extractProfile(text: string): Promise<UserProfile> {
  return text;
}

const profile = await service.extractProfile('John is 25 and loves coding');
console.log(profile.name); // Type-safe!
```

### Function Calling

```typescript
const response = await aiService.complete({
  messages: [{ role: 'user', content: 'What is the weather in NYC?' }],
  provider: 'openai',
  model: 'gpt-4',
  functions: [
    {
      name: 'get_weather',
      description: 'Get the current weather in a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
        },
        required: ['location'],
      },
    },
  ],
  functionCall: 'auto',
});

if (response.functionCall) {
  console.log('Function:', response.functionCall.name);
  console.log('Arguments:', response.functionCall.arguments);
}
```

## Configuration

### Global Configuration

```typescript
import { AIModule } from '@hazeljs/ai';

@HazelModule({
  imports: [
    AIModule.forRoot({
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          organization: process.env.OPENAI_ORG,
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
        },
        gemini: {
          apiKey: process.env.GEMINI_API_KEY,
        },
      },
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      cache: {
        enabled: true,
        ttl: 3600,
      },
    }),
  ],
})
export class AppModule {}
```

### Per-Task Configuration

```typescript
@AITask({
  name: 'custom-task',
  prompt: 'Process: {{input}}',
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
  topP: 0.9,
  frequencyPenalty: 0.5,
  presencePenalty: 0.5,
  stop: ['\n\n'],
})
async processInput(input: string): Promise<string> {
  return input;
}
```

## Use Cases

### Chatbot

```typescript
@Injectable()
export class ChatbotService {
  private conversationHistory: Array<{ role: string; content: string }> = [];

  @AITask({
    name: 'chat',
    provider: 'openai',
    model: 'gpt-4',
  })
  async chat(message: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: message });
    
    const response = await this.aiService.complete({
      messages: this.conversationHistory,
      provider: 'openai',
      model: 'gpt-4',
    });

    this.conversationHistory.push({ 
      role: 'assistant', 
      content: response.content 
    });

    return response.content;
  }
}
```

### Content Generation

```typescript
@Injectable()
export class ContentService {
  @AITask({
    name: 'generate-blog',
    prompt: `Write a blog post about {{topic}}.
    
    Requirements:
    - Length: {{length}} words
    - Tone: {{tone}}
    - Include SEO keywords: {{keywords}}`,
    provider: 'openai',
    model: 'gpt-4',
    outputType: 'string',
  })
  async generateBlogPost(
    topic: string,
    length: number,
    tone: string,
    keywords: string[]
  ): Promise<string> {
    return topic;
  }
}
```

### Data Extraction

```typescript
interface ExtractedData {
  entities: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
}

@Injectable()
export class AnalysisService {
  @AITask({
    name: 'analyze-text',
    prompt: `Analyze the following text and extract:
    1. Named entities (people, places, organizations)
    2. Overall sentiment
    3. Brief summary
    
    Text: {{text}}
    
    Return as JSON.`,
    provider: 'openai',
    model: 'gpt-4',
    outputType: 'json',
  })
  async analyzeText(text: string): Promise<ExtractedData> {
    return text;
  }
}
```

## API Reference

### AIEnhancedService

```typescript
class AIEnhancedService {
  complete(options: AICompletionOptions): Promise<AIResponse>;
  streamComplete(options: AICompletionOptions): AsyncGenerator<AIStreamChunk>;
  embed(text: string, options?: EmbedOptions): Promise<number[]>;
}
```

### @AITask Decorator

```typescript
@AITask({
  name: string;
  prompt?: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'cohere' | 'ollama';
  model: string;
  outputType?: 'string' | 'json' | 'number' | 'boolean';
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  cache?: CacheOptions;
  retry?: RetryOptions;
})
```

## Examples

See the [examples](../../example/src/ai) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/ai)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
