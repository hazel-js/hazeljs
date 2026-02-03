# Anthropic Claude Provider - Production Setup

The Anthropic provider is now **production-ready** with full Anthropic SDK integration.

## Installation

```bash
npm install @anthropic-ai/sdk
```

## Configuration

Set your Anthropic API key as an environment variable:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

Or pass it directly to the provider:

```typescript
import { AnthropicProvider } from '@hazeljs/ai';

const anthropic = new AnthropicProvider('your-api-key-here');
```

## Get Your API Key

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key

## Features

### ✅ Text Completion

```typescript
const response = await anthropic.complete({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing' }
  ],
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 2000
});

console.log(response.content);
console.log(response.usage); // Token usage statistics
```

### ✅ Streaming Responses

```typescript
const stream = anthropic.streamComplete({
  messages: [
    { role: 'user', content: 'Write a creative story' }
  ],
  model: 'claude-3-5-sonnet-20241022'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
  
  if (chunk.done) {
    console.log('\n\nUsage:', chunk.usage);
  }
}
```

### ❌ Embeddings Not Supported

Anthropic does not provide an embeddings API. Use OpenAI or Cohere for embeddings:

```typescript
// This will throw an error
await anthropic.embed({ input: 'text' }); // ❌

// Use OpenAI or Cohere instead
import { OpenAIProvider, CohereProvider } from '@hazeljs/ai';
const openai = new OpenAIProvider();
await openai.embed({ input: 'text' }); // ✅
```

### ✅ Availability Check

```typescript
const isAvailable = await anthropic.isAvailable();
console.log('Anthropic available:', isAvailable);
```

## Supported Models

### Claude 3.5 (Latest)
- **claude-3-5-sonnet-20241022** - Latest and most intelligent model (recommended)
- **claude-3-5-sonnet-20240620** - Previous version

### Claude 3
- **claude-3-opus-20240229** - Most powerful for complex tasks
- **claude-3-sonnet-20240229** - Balanced performance and cost
- **claude-3-haiku-20240307** - Fast and cost-effective

### Claude 2 (Legacy)
- **claude-2.1** - Previous generation
- **claude-2.0** - Previous generation

## Model Comparison

| Model | Context | Speed | Cost | Best For |
|-------|---------|-------|------|----------|
| Claude 3.5 Sonnet | 200K | Fast | $$ | Most use cases (recommended) |
| Claude 3 Opus | 200K | Slow | $$$ | Complex reasoning, analysis |
| Claude 3 Sonnet | 200K | Medium | $$ | Balanced tasks |
| Claude 3 Haiku | 200K | Very Fast | $ | Simple, fast responses |

## Error Handling

The provider includes comprehensive error handling:

```typescript
try {
  const response = await anthropic.complete({
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  console.error('Anthropic API error:', error.message);
  // Handle rate limits, invalid API keys, etc.
}
```

## Usage with HazelJS Framework

### In Controllers

```typescript
import { Controller, Post, Body, Injectable } from '@hazeljs/core';
import { AnthropicProvider } from '@hazeljs/ai';

@Injectable()
@Controller('/api/ai')
export class AIController {
  private anthropic: AnthropicProvider;

  constructor() {
    this.anthropic = new AnthropicProvider();
  }

  @Post('/chat')
  async chat(@Body() body: { message: string }) {
    const response = await this.anthropic.complete({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: body.message }
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7
    });

    return { reply: response.content };
  }

  @Post('/stream')
  async stream(@Body() body: { message: string }) {
    const stream = this.anthropic.streamComplete({
      messages: [
        { role: 'user', content: body.message }
      ],
      model: 'claude-3-haiku-20240307'
    });

    // Return stream to client
    return stream;
  }
}
```

### With Agent Runtime

```typescript
import { AgentRuntime } from '@hazeljs/agent';
import { AnthropicProvider } from '@hazeljs/ai';

const anthropic = new AnthropicProvider();

const llmProvider = {
  chat: async (options: any) => {
    const response = await anthropic.complete({
      messages: options.messages,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 4096,
    });

    return {
      content: response.content,
      tool_calls: [],
    };
  },
};

const runtime = new AgentRuntime({
  llmProvider,
  defaultMaxSteps: 10,
});
```

### Multi-Turn Conversations

```typescript
import { AnthropicProvider } from '@hazeljs/ai';

class ConversationManager {
  private anthropic: AnthropicProvider;
  private history: Array<{ role: string; content: string }> = [];

  constructor() {
    this.anthropic = new AnthropicProvider();
    // Add system message
    this.history.push({
      role: 'system',
      content: 'You are a helpful AI assistant.'
    });
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.history.push({
      role: 'user',
      content: userMessage
    });

    // Get response
    const response = await this.anthropic.complete({
      messages: this.history,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7
    });

    // Add assistant response to history
    this.history.push({
      role: 'assistant',
      content: response.content
    });

    return response.content;
  }

  clearHistory() {
    this.history = [{
      role: 'system',
      content: 'You are a helpful AI assistant.'
    }];
  }
}

// Usage
const conversation = new ConversationManager();
await conversation.chat('Hello!');
await conversation.chat('What did I just say?'); // Claude remembers context
```

## Rate Limits & Quotas

Anthropic API has the following limits:

- **Free tier**: Limited requests per minute
- **Paid tier**: Higher limits based on your plan
- **Enterprise**: Custom limits and dedicated support

Monitor your usage in the [Anthropic Console](https://console.anthropic.com/).

## Best Practices

1. **Choose the Right Model**:
   - Use `claude-3-5-sonnet-20241022` for most use cases (best balance)
   - Use `claude-3-opus-20240229` for complex reasoning tasks
   - Use `claude-3-haiku-20240307` for simple, fast responses

2. **System Messages**:
   - Always include a system message to set context
   - Claude responds well to clear instructions

3. **Context Management**:
   - Claude has a 200K token context window
   - Manage conversation history to stay within limits
   - Summarize old messages if needed

4. **Temperature Settings**:
   - Use 0.0-0.3 for factual, deterministic responses
   - Use 0.7-1.0 for creative, varied responses

5. **Error Handling**:
   - Implement retry logic with exponential backoff
   - Handle rate limits gracefully
   - Log errors for debugging

6. **Token Usage**:
   - Monitor `response.usage` to track costs
   - Set appropriate `maxTokens` limits
   - Use streaming for long responses

## Claude-Specific Advantages

### 1. Long Context Window
200K tokens = ~150,000 words of context

### 2. Strong Reasoning
Excellent at complex analysis, coding, and problem-solving

### 3. Safety & Alignment
Built with strong safety measures and ethical guidelines

### 4. Clear Communication
Produces well-structured, easy-to-understand responses

### 5. Multimodal (Vision)
Claude 3 models can analyze images (not yet in this provider)

## Example: Code Analysis

```typescript
import { AnthropicProvider } from '@hazeljs/ai';

async function analyzeCode(code: string) {
  const anthropic = new AnthropicProvider();

  const response = await anthropic.complete({
    messages: [
      {
        role: 'system',
        content: 'You are an expert code reviewer. Analyze code for bugs, performance issues, and best practices.'
      },
      {
        role: 'user',
        content: `Please review this code:\n\n\`\`\`\n${code}\n\`\`\``
      }
    ],
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.3
  });

  return response.content;
}
```

## Example: Document Summarization

```typescript
import { AnthropicProvider } from '@hazeljs/ai';

async function summarizeDocument(document: string) {
  const anthropic = new AnthropicProvider();

  const response = await anthropic.complete({
    messages: [
      {
        role: 'system',
        content: 'You are a professional summarizer. Create concise, accurate summaries.'
      },
      {
        role: 'user',
        content: `Summarize this document in 3-5 bullet points:\n\n${document}`
      }
    ],
    model: 'claude-3-haiku-20240307', // Fast model for summarization
    temperature: 0.3,
    maxTokens: 500
  });

  return response.content;
}
```

## Migration from Mock Implementation

If you were using the previous mock implementation, no code changes are needed! Simply:

1. Install `@anthropic-ai/sdk`
2. Set your `ANTHROPIC_API_KEY`
3. Rebuild your project

The provider will automatically use the real API instead of mock responses.

## Troubleshooting

### "API key not configured"
- Ensure `ANTHROPIC_API_KEY` is set in your environment
- Or pass the API key directly to the constructor

### "Cannot find module '@anthropic-ai/sdk'"
- Run `npm install @anthropic-ai/sdk` in your project
- Rebuild with `npm run build`

### Rate limit errors
- Implement retry logic with exponential backoff
- Consider upgrading to a higher tier
- Use `claude-3-haiku` for less critical requests

### "Anthropic does not support embeddings"
- This is expected - Anthropic doesn't provide embeddings
- Use OpenAI or Cohere for embeddings instead

## Performance Tips

1. **Use Haiku for Speed**: For simple tasks, Claude 3 Haiku is 3x faster
2. **Stream Long Responses**: Use streaming for better UX
3. **Batch Similar Requests**: Process multiple items in parallel
4. **Cache System Messages**: Reuse the same system prompt
5. **Set Token Limits**: Use `maxTokens` to control response length

## Cost Optimization

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude 3.5 Sonnet | $3 | $15 |
| Claude 3 Opus | $15 | $75 |
| Claude 3 Sonnet | $3 | $15 |
| Claude 3 Haiku | $0.25 | $1.25 |

**Tips**:
- Use Haiku for simple tasks (12x cheaper than Opus)
- Set appropriate `maxTokens` limits
- Monitor usage in the console

## Resources

- [Anthropic Documentation](https://docs.anthropic.com/)
- [Anthropic Console](https://console.anthropic.com/)
- [Pricing Information](https://www.anthropic.com/pricing)
- [Model Comparison](https://docs.anthropic.com/claude/docs/models-overview)
- [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [API Reference](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)

## Support

- **Anthropic**: [support@anthropic.com](mailto:support@anthropic.com)
- **HazelJS**: [GitHub Issues](https://github.com/hazel-js/hazeljs/issues)
