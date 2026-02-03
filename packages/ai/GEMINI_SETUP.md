# Google Gemini Provider - Production Setup

The Gemini provider is now **production-ready** with full Google Generative AI SDK integration.

## Installation

```bash
npm install @google/generative-ai
```

## Configuration

Set your Gemini API key as an environment variable:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or pass it directly to the provider:

```typescript
import { GeminiProvider } from '@hazeljs/ai';

const gemini = new GeminiProvider('your-api-key-here');
```

## Get Your API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

## Features

### ✅ Text Completion

```typescript
const response = await gemini.complete({
  messages: [
    { role: 'user', content: 'Explain quantum computing in simple terms' }
  ],
  model: 'gemini-pro',
  temperature: 0.7,
  maxTokens: 1000
});

console.log(response.content);
console.log(response.usage); // Token usage statistics
```

### ✅ Streaming Responses

```typescript
const stream = gemini.streamComplete({
  messages: [
    { role: 'user', content: 'Write a story about a robot' }
  ],
  model: 'gemini-pro'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
  
  if (chunk.done) {
    console.log('\n\nUsage:', chunk.usage);
  }
}
```

### ✅ Text Embeddings

```typescript
const embeddings = await gemini.embed({
  input: [
    'Machine learning is a subset of AI',
    'Deep learning uses neural networks'
  ],
  model: 'text-embedding-004'
});

console.log(embeddings.embeddings); // Array of embedding vectors
console.log(embeddings.usage); // Token usage
```

### ✅ Availability Check

```typescript
const isAvailable = await gemini.isAvailable();
console.log('Gemini available:', isAvailable);
```

## Supported Models

### Text Generation
- **gemini-pro** - Standard text generation model
- **gemini-pro-vision** - Multimodal model (text + images)
- **gemini-1.5-pro** - Latest model with 1M token context window
- **gemini-1.5-flash** - Faster, cost-effective model

### Embeddings
- **text-embedding-004** - Latest embedding model (768 dimensions)

## Error Handling

The provider includes comprehensive error handling:

```typescript
try {
  const response = await gemini.complete({
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  console.error('Gemini API error:', error.message);
  // Handle rate limits, invalid API keys, etc.
}
```

## Usage with HazelJS Framework

### In Controllers

```typescript
import { Controller, Get, Injectable } from '@hazeljs/core';
import { GeminiProvider } from '@hazeljs/ai';

@Injectable()
@Controller('/api/ai')
export class AIController {
  private gemini: GeminiProvider;

  constructor() {
    this.gemini = new GeminiProvider();
  }

  @Get('/generate')
  async generate() {
    const response = await this.gemini.complete({
      messages: [
        { role: 'user', content: 'Generate a creative product name' }
      ],
      model: 'gemini-1.5-flash',
      temperature: 0.9
    });

    return { text: response.content };
  }
}
```

### With Agent Runtime

```typescript
import { AgentRuntime } from '@hazeljs/agent';
import { GeminiProvider } from '@hazeljs/ai';

const gemini = new GeminiProvider();

const llmProvider = {
  chat: async (options: any) => {
    const response = await gemini.complete({
      messages: options.messages,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 2000,
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

## Rate Limits & Quotas

Gemini API has the following limits (as of 2024):

- **Free tier**: 60 requests per minute
- **Paid tier**: Higher limits based on your plan

Monitor your usage in the [Google Cloud Console](https://console.cloud.google.com/).

## Best Practices

1. **Cache API Key**: Initialize the provider once and reuse it
2. **Handle Rate Limits**: Implement exponential backoff for retries
3. **Use Appropriate Models**: 
   - Use `gemini-1.5-flash` for faster, cheaper responses
   - Use `gemini-1.5-pro` for complex reasoning tasks
4. **Monitor Token Usage**: Track `response.usage` to optimize costs
5. **Set Reasonable Limits**: Use `maxTokens` to control response length

## Migration from Mock Implementation

If you were using the previous mock implementation, no code changes are needed! The API interface remains the same. Simply:

1. Install `@google/generative-ai`
2. Set your `GEMINI_API_KEY`
3. Rebuild your project

The provider will automatically use the real API instead of mock responses.

## Troubleshooting

### "API key not configured"
- Ensure `GEMINI_API_KEY` is set in your environment
- Or pass the API key directly to the constructor

### "Cannot find module '@google/generative-ai'"
- Run `npm install @google/generative-ai` in your project
- Rebuild with `npm run build`

### Rate limit errors
- Implement retry logic with exponential backoff
- Consider upgrading to a paid tier for higher limits

## Resources

- [Google AI Studio](https://makersuite.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Pricing Information](https://ai.google.dev/pricing)
- [Model Comparison](https://ai.google.dev/models/gemini)
