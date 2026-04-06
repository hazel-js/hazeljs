# @hazeljs/ai

**Add AI to your API in minutes — not days.**

Part of the HazelJS AI-Native Backend Framework. OpenAI, Anthropic, Gemini, Cohere, Ollama. Decorators for quick tasks and **HCEL** for fluent orchestration. Streaming, caching, retries, and type-safe outputs. Ship AI features without the glue code.

**🚀 Trusted by 200K+ monthly downloads • 37+ GitHub stars • 15+ daily active developers**

[![npm version](https://img.shields.io/npm/v/@hazeljs/ai.svg)](https://www.npmjs.com/package/@hazeljs/ai)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/ai)](https://www.npmjs.com/package/@hazeljs/ai)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Why @hazeljs/ai?

Built for **AI-native applications** - not just another AI integration. When you combine @hazeljs/ai with @hazeljs/core, @hazeljs/agent, and @hazeljs/rag, you get a complete stack for intelligent backends.

**Perfect for:**
- AI startups adding chat/completion features
- Teams building AI-powered APIs without complexity
- Developers who want decorator-based AI integration
- Projects needing multiple AI providers in one interface

## Features

- ⚡ **HCEL Orchestration** - Fluent chains for prompts, RAG, agents, ML, and observability
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

## HCEL (Hazel Composable Expression Language)

HCEL is the fastest way to compose multi-step AI pipelines in TypeScript.  
Instead of manually wiring outputs between services, you define one fluent chain.

### Why HCEL is easier

- No manual glue code between prompt, retrieval, agent, and ML steps
- Implicit context passing across operations
- Built-in observability hooks for production tracing

### Example: Prompt -> RAG -> Agent -> ML

```typescript
import { HazelAI } from '@hazeljs/ai';

const ai = HazelAI.create({
  defaultProvider: 'openai',
  model: 'gpt-4o',
});

const result = await ai.hazel
  .prompt('Summarize this support request: {{input}}')
  .rag('support-kb')
  .agent('support-specialist')
  .ml('sentiment')
  .execute('Customer reports repeated payment failures after card update.');
```

### Example: Context + Observability

```typescript
const chain = ai.hazel
  .prompt('Analyze this feedback: {{feedback}}')
  .ml('sentiment')
  .context({ userId: 'u-123', sessionId: 's-456' })
  .observe((event) => {
    console.log(`[${event.type}]`, event.timestamp);
  });

const output = await chain.execute();
```

### Example: Parallel Operations

```typescript
const parallelResult = await ai.hazel
  .parallel(
    ai.hazel.prompt('Summarize: {{input}}'),
    ai.hazel.ml('sentiment')
  )
  .execute('HazelJS made our AI backend migration much simpler.');
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

## 🚀 New: HazelJS Unified AI Platform

**Single entry point for all AI capabilities** - Introducing the `HazelAI` class that brings together all AI features in one elegant API.

### What's New?

#### 🎯 **Unified API**
```typescript
import { HazelAI } from '@hazeljs/ai';

// One class for everything
const ai = HazelAI.create({
  defaultProvider: 'openai',
  model: 'gpt-4o',
});

// All AI capabilities through one interface
await ai.chat('Hello');
await ai.stream('Tell me a story');
await ai.sentiment('I love this!');
await ai.score('Rate this text', { items, criteria });
await ai.workflow('process').step(...).run(data);
const assistant = ai.assistant({ memory: true });
```

#### 🏗️ **6 AI Facades**
- **ChatFacade** - Simple chat and streaming
- **RAGFacade** - Document Q&A with retrieval
- **AgentFacade** - Specialized AI agents
- **MLFacade** - Classification, sentiment, scoring
- **WorkflowFacade** - Chain multiple AI steps
- **AssistantFacade** - Memory-enabled conversations

#### 📊 **Built-in Metrics**
```typescript
const metrics = ai.getMetrics();
console.log(`Requests: ${metrics.totalRequests}`);
console.log(`Tokens: ${metrics.totalTokens}`);
console.log(`Latency: ${metrics.averageLatencyMs}ms`);
console.log(`Cost: $${metrics.costEstimate}`);
```

### Benefits

#### 🚀 **Developer Experience**
- **Single Import** - `import { HazelAI } from '@hazeljs/ai'`
- **HCEL Fluent API** - Compose AI pipelines with a single chain
- **Type Safety** - Full TypeScript support with autocomplete
- **Consistent API** - Same patterns across all AI features
- **Zero Boilerplate** - Get started in 3 lines of code

#### 💪 **Powerful Features**
- **Multi-Provider** - Switch between OpenAI, Anthropic, Gemini, Cohere, Ollama
- **Graceful Fallbacks** - Automatic provider switching on errors
- **Memory Management** - Built-in conversation history for assistants
- **Workflow Orchestration** - Chain AI steps with timing and error handling

#### 🔧 **Production Ready**
- **Token Tracking** - Monitor usage and costs per provider
- **Retry Logic** - Automatic retries with exponential backoff
- **Error Handling** - Graceful degradation for optional dependencies
- **Performance** - Optimized for high-throughput applications

### Quick Examples

#### Basic Chat
```typescript
import { HazelAI } from '@hazeljs/ai';

const ai = HazelAI.create({ defaultProvider: 'openai' });

// Simple chat
const response = await ai.chat('What is HazelJS?');
console.log(response.content);

// Streaming chat
for await (const chunk of ai.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

#### ML Operations
```typescript
// Sentiment analysis
const sentiment = await ai.sentiment('I love using HazelJS!');
console.log(`${sentiment.sentiment} (${sentiment.score})`);

// Classification
const category = await ai.classify('This is about technology', {
  labels: ['tech', 'sports', 'politics'],
});

// Scoring
const scores = await ai.score('Rate for accuracy', {
  items: [{ id: '1', text: 'TypeScript is typed JavaScript' }],
  criteria: 'Technical accuracy',
});
```

#### Workflows
```typescript
const result = await ai.workflow('process')
  .step('extract', async (text: string) => {
    return text.split(' ');
  })
  .step('analyze', async (words: string[]) => {
    return { count: words.length, avgLength: words.reduce((sum, w) => sum + w.length, 0) / words.length };
  })
  .run('Hello world');

console.log(result.output); // { count: 2, avgLength: 5 }
console.log(result.totalDuration); // 5ms
```

#### Assistants with Memory
```typescript
const assistant = ai.assistant({
  name: 'HelpBot',
  systemPrompt: 'You are a helpful assistant',
  memory: true,
});

await assistant.chat('My name is John');
await assistant.chat('What is my name?'); // Remembers "John"

console.log(assistant.sessionId); // Unique session
console.log(assistant.getHistory()); // Full conversation
```

### Migration Guide

#### From AIEnhancedService
```typescript
// Before
import { AIEnhancedService } from '@hazeljs/ai';
const ai = new AIEnhancedService();
await ai.complete({ messages, provider: 'openai' });

// After
import { HazelAI } from '@hazeljs/ai';
const ai = HazelAI.create({ defaultProvider: 'openai' });
await ai.chat('Hello');
```

#### From Multiple Imports
```typescript
// Before
import { ChatService } from '@hazeljs/ai';
import { MLService } from '@hazeljs/ml';
import { AgentService } from '@hazeljs/agent';

// After
import { HazelAI } from '@hazeljs/ai';
const ai = HazelAI.create();
// All services available through ai.*
```

### Advanced Usage

#### Provider Configuration
```typescript
const ai = HazelAI.create({
  defaultProvider: 'openai',
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  },
  model: 'gpt-4o',
  temperature: 0.7,
});
```

#### Error Handling
```typescript
try {
  const response = await ai.chat('Hello');
} catch (error) {
  if (error.message.includes('Provider not available')) {
    // Fallback to another provider
    const response = await ai.chat('Hello', { provider: 'ollama' });
  }
}
```

#### Custom Workflows
```typescript
const dataProcessor = ai.workflow('data-pipeline');

const result = await dataProcessor
  .step('validate', async (data) => {
    if (!data.isValid) throw new Error('Invalid data');
    return data;
  })
  .step('transform', async (data) => {
    return { ...data, processed: true };
  })
  .step('store', async (data) => {
    await database.save(data);
    return data.id;
  })
  .run(inputData);
```

### What's Under the Hood?

The Unified AI Platform is built on the same robust foundation you trust:

- **AIEnhancedService** - Core AI engine with provider management
- **TokenTracker** - Usage and cost monitoring
- **Retry Logic** - Automatic error recovery
- **Caching** - Response caching with TTL
- **Type Safety** - Full TypeScript coverage

The `HazelAI` class is a thin, opinionated wrapper that combines:
- All facades into one interface
- Consistent configuration management
- Unified error handling
- Centralized metrics collection

### Examples Repository

Check out the `examples/` directory for complete, runnable examples:

- **simple-demo.ts** - Basic functionality without API keys
- **unified-platform-example.ts** - Full demo with all features
- **README.md** - Detailed setup and usage instructions

Run examples:
```bash
npm run demo:simple  # Basic demo
npm run demo:full    # Full demo (requires API keys)
```

### Backward Compatibility

**All existing APIs continue to work unchanged.** The Unified AI Platform is an additional layer on top of the existing architecture.

```typescript
// This still works exactly as before
import { AIEnhancedService } from '@hazeljs/ai';
const service = new AIEnhancedService();
await service.complete({ messages, provider: 'openai' });

// Decorators still work
@AITask({ name: 'chat', prompt: 'Respond to: {{input}}' })
async chat(input: string): Promise<string> { return input; }
```

### Next Steps

1. **Try the simple demo** - `npm run demo:simple`
2. **Set up API keys** and run the full demo - `npm run demo:full`
3. **Read the examples** in `examples/README.md`
4. **Check the API docs** for detailed method signatures
5. **Join our Discord** for community support

---

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/ai)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/PxNBPzvQk7)
