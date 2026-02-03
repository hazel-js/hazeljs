# HazelJS AI Providers - Overview

All AI providers in HazelJS are now **production-ready** with full SDK integration.

## Available Providers

| Provider | Status | SDK | Best For |
|----------|--------|-----|----------|
| **OpenAI** | ✅ Production | `openai` | GPT-4, GPT-3.5, DALL-E, Whisper |
| **Gemini** | ✅ Production | `@google/generative-ai` | Google's latest models, long context |
| **Cohere** | ✅ Production | `cohere-ai` | RAG, reranking, multilingual |
| **Anthropic** | ✅ Production | `@anthropic-ai/sdk` | Claude models, reasoning, safety |

## Quick Start

### 1. Install Dependencies

```bash
# Install the providers you need
npm install openai                    # OpenAI
npm install @google/generative-ai     # Gemini
npm install cohere-ai                 # Cohere
npm install @anthropic-ai/sdk         # Anthropic (coming soon)
```

### 2. Set API Keys

```bash
export OPENAI_API_KEY="your-openai-key"
export GEMINI_API_KEY="your-gemini-key"
export COHERE_API_KEY="your-cohere-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

### 3. Use in Your Application

```typescript
import { OpenAIProvider, GeminiProvider, CohereProvider } from '@hazeljs/ai';

// Initialize providers
const openai = new OpenAIProvider();
const gemini = new GeminiProvider();
const cohere = new CohereProvider();

// Use any provider with the same interface
const response = await openai.complete({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4',
  temperature: 0.7
});
```

## Provider Comparison

### OpenAI
**Best for**: General-purpose AI, most mature ecosystem

**Strengths**:
- Industry-leading GPT-4 and GPT-3.5 models
- Excellent function calling support
- DALL-E for image generation
- Whisper for speech-to-text
- Large community and extensive documentation

**Models**:
- `gpt-4-turbo-preview` - Most capable
- `gpt-4` - Balanced performance
- `gpt-3.5-turbo` - Fast and cost-effective
- `text-embedding-3-large` - Best embeddings (3072 dims)
- `dall-e-3` - Image generation

**Pricing**: $$ (moderate to high)

**Setup Guide**: See [OpenAI Documentation](https://platform.openai.com/docs)

---

### Gemini (Google)
**Best for**: Long context windows, multimodal tasks

**Strengths**:
- 1M+ token context window (gemini-1.5-pro)
- Native multimodal support (text + images)
- Competitive pricing
- Strong reasoning capabilities
- Free tier available

**Models**:
- `gemini-1.5-pro` - Extended context, most capable
- `gemini-1.5-flash` - Fast and cost-effective
- `gemini-pro` - Standard model
- `gemini-pro-vision` - Multimodal
- `text-embedding-004` - Embeddings (768 dims)

**Pricing**: $ (cost-effective)

**Setup Guide**: See [`GEMINI_SETUP.md`](./GEMINI_SETUP.md)

---

### Cohere
**Best for**: RAG applications, reranking, multilingual

**Strengths**:
- **Industry-leading reranking** for RAG
- Excellent multilingual support
- Purpose-built for enterprise search
- Competitive pricing
- Strong embedding models

**Models**:
- `command-r-plus` - Most powerful
- `command-r` - Balanced (recommended)
- `command-light` - Fast and cheap
- `embed-english-v3.0` - English embeddings (1024 dims)
- `embed-multilingual-v3.0` - Multilingual embeddings
- `rerank-english-v3.0` - Document reranking

**Unique Features**:
- Document reranking (perfect for RAG)
- Fine-tuning support
- Enterprise features

**Pricing**: $ (cost-effective)

**Setup Guide**: See [`COHERE_SETUP.md`](./COHERE_SETUP.md)

---

### Anthropic
**Best for**: Claude models, complex reasoning, safety-focused AI

**Strengths**:
- Claude 3.5 Sonnet - Latest and most intelligent
- 200K token context window
- Excellent reasoning and analysis
- Strong safety and ethical guidelines
- Clear, well-structured responses
- No embeddings (use OpenAI/Cohere instead)

**Models**:
- `claude-3-5-sonnet-20241022` - Latest (recommended)
- `claude-3-opus-20240229` - Most powerful
- `claude-3-sonnet-20240229` - Balanced
- `claude-3-haiku-20240307` - Fast and cheap

**Pricing**: $$ (moderate)

**Setup Guide**: See [`ANTHROPIC_SETUP.md`](./ANTHROPIC_SETUP.md)

---

## Use Case Recommendations

### General Chat & Completion
- **Best**: Claude 3.5 Sonnet or OpenAI GPT-4
- **Alternative**: Gemini 1.5-pro
- **Budget**: Gemini 1.5-flash or Claude 3 Haiku

### RAG (Retrieval-Augmented Generation)
- **Best**: Cohere (with reranking)
- **Alternative**: OpenAI with embeddings
- **Why Cohere**: Built-in reranking significantly improves retrieval quality

### Long Context (100K+ tokens)
- **Best**: Gemini 1.5-pro (1M tokens)
- **Alternative**: Claude 3.5 Sonnet (200K tokens)
- **Also Good**: GPT-4-turbo (128K tokens)

### Multilingual
- **Best**: Cohere (purpose-built)
- **Alternative**: Gemini

### Cost-Effective
- **Best**: Claude 3 Haiku
- **Alternative**: Gemini 1.5-flash
- **Also Good**: Cohere command-light

### Function Calling
- **Best**: OpenAI GPT-4
- **Alternative**: Gemini

### Embeddings
- **Best Quality**: OpenAI text-embedding-3-large (3072 dims)
- **Best Speed**: Cohere embed-english-light-v3.0
- **Multilingual**: Cohere embed-multilingual-v3.0

## Unified Interface

All providers implement the same interface, making it easy to switch:

```typescript
interface IAIProvider {
  // Text completion
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  
  // Streaming completion
  streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk>;
  
  // Generate embeddings
  embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;
  
  // Check availability
  isAvailable(): Promise<boolean>;
  
  // Get supported models
  getSupportedModels(): string[];
}
```

## Example: Multi-Provider Setup

```typescript
import { OpenAIProvider, GeminiProvider, CohereProvider } from '@hazeljs/ai';

class AIService {
  private providers: Map<string, IAIProvider>;

  constructor() {
    this.providers = new Map([
      ['openai', new OpenAIProvider()],
      ['gemini', new GeminiProvider()],
      ['cohere', new CohereProvider()],
      ['anthropic', new AnthropicProvider()],
    ]);
  }

  async complete(provider: string, prompt: string) {
    const ai = this.providers.get(provider);
    if (!ai) throw new Error(`Provider ${provider} not found`);

    return await ai.complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
  }

  // Fallback to another provider if one fails
  async completeWithFallback(prompt: string) {
    const providers = ['anthropic', 'openai', 'gemini', 'cohere'];
    
    for (const provider of providers) {
      try {
        return await this.complete(provider, prompt);
      } catch (error) {
        console.warn(`${provider} failed, trying next...`);
      }
    }
    
    throw new Error('All providers failed');
  }
}
```

## Example: RAG with Cohere Reranking

```typescript
import { CohereProvider } from '@hazeljs/ai';
import { RAGService } from '@hazeljs/rag';

async function smartSearch(query: string) {
  const cohere = new CohereProvider();
  const rag = new RAGService(/* config */);

  // 1. Initial retrieval (cast wide net)
  const candidates = await rag.search(query, { topK: 20 });
  
  // 2. Rerank with Cohere (improve relevance)
  const reranked = await cohere.rerank(
    query,
    candidates.map(c => c.content),
    5
  );

  // 3. Generate answer with best results
  const context = reranked.map(r => r.document).join('\n\n');
  
  const response = await cohere.complete({
    messages: [
      { role: 'system', content: 'Answer based on context.' },
      { role: 'user', content: `Context:\n${context}\n\nQ: ${query}` }
    ],
    model: 'command-r-plus'
  });

  return {
    answer: response.content,
    sources: reranked
  };
}
```

## Example: Streaming with Multiple Providers

```typescript
async function streamResponse(provider: 'openai' | 'gemini' | 'cohere' | 'anthropic', prompt: string) {
  const providers = {
    openai: new OpenAIProvider(),
    gemini: new GeminiProvider(),
    cohere: new CohereProvider(),
    anthropic: new AnthropicProvider()
  };

  const ai = providers[provider];
  const stream = ai.streamComplete({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.delta);
    
    if (chunk.done && chunk.usage) {
      console.log('\n\nTokens used:', chunk.usage.totalTokens);
    }
  }
}
```

## Cost Optimization Tips

1. **Use Appropriate Models**:
   - Development: Gemini 1.5-flash or Cohere command-light
   - Production: Based on requirements

2. **Cache Embeddings**: Store embeddings in a vector database

3. **Batch Requests**: Process multiple items in single API calls

4. **Set Token Limits**: Use `maxTokens` to control costs

5. **Monitor Usage**: Track token consumption across providers

6. **Fallback Strategy**: Start with cheaper models, escalate if needed

## Error Handling Best Practices

```typescript
import { OpenAIProvider, GeminiProvider } from '@hazeljs/ai';

async function robustCompletion(prompt: string) {
  const providers = [
    new OpenAIProvider(),
    new GeminiProvider()
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      // Check availability first
      if (!(await provider.isAvailable())) {
        continue;
      }

      return await provider.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      });
    } catch (error) {
      lastError = error as Error;
      console.warn(`Provider failed: ${error.message}`);
      
      // Wait before trying next provider
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError?.message}`);
}
```

## Testing

All providers support the same interface, making testing easy:

```typescript
import { OpenAIProvider } from '@hazeljs/ai';

describe('AI Provider', () => {
  it('should generate completion', async () => {
    const provider = new OpenAIProvider();
    
    const response = await provider.complete({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-3.5-turbo',
      maxTokens: 50
    });

    expect(response.content).toBeDefined();
    expect(response.usage).toBeDefined();
  });
});
```

## Next Steps

1. **Choose Your Providers**: Based on your use case
2. **Install SDKs**: Run `npm install` for needed packages
3. **Set API Keys**: Configure environment variables
4. **Read Setup Guides**: 
   - [Anthropic Setup](./ANTHROPIC_SETUP.md)
   - [Gemini Setup](./GEMINI_SETUP.md)
   - [Cohere Setup](./COHERE_SETUP.md)
5. **Start Building**: Use the unified interface

## Support

- **OpenAI**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Anthropic**: [docs.anthropic.com](https://docs.anthropic.com/)
- **Gemini**: [ai.google.dev/docs](https://ai.google.dev/docs)
- **Cohere**: [docs.cohere.com](https://docs.cohere.com/)
- **HazelJS**: [GitHub Issues](https://github.com/hazel-js/hazeljs/issues)

## Contributing

Want to add more providers? Check out the existing implementations and submit a PR!
