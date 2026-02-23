# HazelJS AI Providers - Production Ready ✅

All AI providers in the `@hazeljs/ai` package are now **production-ready** with full SDK integration!

## 🎉 What's New

All four major AI providers have been upgraded from mock implementations to production-ready integrations:

- ✅ **OpenAI** - Already production-ready
- ✅ **Gemini** - Now production-ready (NEW!)
- ✅ **Cohere** - Now production-ready (NEW!)
- ✅ **Anthropic** - Now production-ready (NEW!)

## 📦 Installation

```bash
# Install all providers
npm install openai @google/generative-ai cohere-ai @anthropic-ai/sdk

# Or install only what you need
npm install @google/generative-ai  # Gemini
npm install cohere-ai              # Cohere
npm install @anthropic-ai/sdk      # Anthropic
```

## 🔑 Configuration

Set your API keys as environment variables:

```bash
export OPENAI_API_KEY="your-openai-key"
export GEMINI_API_KEY="your-gemini-key"
export COHERE_API_KEY="your-cohere-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

## 🚀 Quick Start

```typescript
import { 
  OpenAIProvider, 
  GeminiProvider, 
  CohereProvider, 
  AnthropicProvider 
} from '@hazeljs/ai';

// Initialize providers
const openai = new OpenAIProvider();
const gemini = new GeminiProvider();
const cohere = new CohereProvider();
const anthropic = new AnthropicProvider();

// All providers share the same interface!
const response = await anthropic.complete({
  messages: [{ role: 'user', content: 'Hello!' }],
  temperature: 0.7
});
```

## 📚 Documentation

Comprehensive setup guides for each provider:

- **[AI Providers Overview](./AI_PROVIDERS.md)** - Compare all providers
- **[Anthropic Setup](./ANTHROPIC_SETUP.md)** - Claude models
- **[Gemini Setup](./GEMINI_SETUP.md)** - Google AI
- **[Cohere Setup](./COHERE_SETUP.md)** - RAG & reranking

## ✨ Key Features

### All Providers Support

- ✅ **Text Completion** - Generate responses
- ✅ **Streaming** - Real-time token-by-token output
- ✅ **Error Handling** - Comprehensive error messages
- ✅ **Token Usage** - Track API costs
- ✅ **Unified Interface** - Switch providers easily

### Provider-Specific Features

| Feature | OpenAI | Gemini | Cohere | Anthropic |
|---------|--------|--------|--------|-----------|
| Text Generation | ✅ | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ | ✅ |
| Embeddings | ✅ | ✅ | ✅ | ❌ |
| Function Calling | ✅ | ✅ | ❌ | ❌ |
| Image Generation | ✅ | ❌ | ❌ | ❌ |
| Document Reranking | ❌ | ❌ | ✅ | ❌ |
| Context Window | 128K | 1M | 200K | 200K |

## 🎯 Use Case Guide

### For General Chat
**Recommended**: Claude 3.5 Sonnet or GPT-4
```typescript
const anthropic = new AnthropicProvider();
const response = await anthropic.complete({
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
  model: 'claude-3-5-sonnet-20241022'
});
```

### For RAG Applications
**Recommended**: Cohere (with reranking)
```typescript
const cohere = new CohereProvider();

// 1. Get embeddings
const embeddings = await cohere.embed({
  input: ['document 1', 'document 2'],
  model: 'embed-english-v3.0'
});

// 2. Rerank results
const reranked = await cohere.rerank(
  'user query',
  candidateDocuments,
  5
);
```

### For Long Context
**Recommended**: Gemini 1.5 Pro (1M tokens)
```typescript
const gemini = new GeminiProvider();
const response = await gemini.complete({
  messages: [{ role: 'user', content: longDocument }],
  model: 'gemini-1.5-pro'
});
```

### For Cost-Effective
**Recommended**: Claude 3 Haiku
```typescript
const anthropic = new AnthropicProvider();
const response = await anthropic.complete({
  messages: [{ role: 'user', content: 'Simple task' }],
  model: 'claude-3-haiku-20240307'
});
```

## 🔄 Provider Comparison

### OpenAI
- **Best for**: General-purpose AI, mature ecosystem
- **Strengths**: GPT-4, function calling, DALL-E, Whisper
- **Pricing**: $$ (moderate to high)

### Gemini
- **Best for**: Long context, multimodal tasks
- **Strengths**: 1M token context, free tier, competitive pricing
- **Pricing**: $ (cost-effective)

### Cohere
- **Best for**: RAG, reranking, multilingual
- **Strengths**: Document reranking, enterprise search
- **Pricing**: $ (cost-effective)

### Anthropic
- **Best for**: Complex reasoning, safety-focused AI
- **Strengths**: Claude 3.5, 200K context, clear responses
- **Pricing**: $$ (moderate)

## 💡 Advanced Examples

### Multi-Provider Fallback

```typescript
class RobustAI {
  private providers = [
    new AnthropicProvider(),
    new OpenAIProvider(),
    new GeminiProvider(),
  ];

  async complete(prompt: string) {
    for (const provider of this.providers) {
      try {
        return await provider.complete({
          messages: [{ role: 'user', content: prompt }]
        });
      } catch (error) {
        console.warn(`${provider.name} failed, trying next...`);
      }
    }
    throw new Error('All providers failed');
  }
}
```

### Smart RAG with Cohere

```typescript
async function smartRAG(query: string, documents: string[]) {
  const cohere = new CohereProvider();

  // 1. Retrieve candidates (cast wide net)
  const candidates = documents.slice(0, 20);

  // 2. Rerank for relevance
  const reranked = await cohere.rerank(query, candidates, 5);

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

### Streaming with Progress

```typescript
async function streamWithProgress(prompt: string) {
  const anthropic = new AnthropicProvider();
  const stream = anthropic.streamComplete({
    messages: [{ role: 'user', content: prompt }]
  });

  let tokenCount = 0;
  for await (const chunk of stream) {
    process.stdout.write(chunk.delta);
    tokenCount += chunk.delta.length;

    if (chunk.done) {
      console.log(`\n\nTokens: ${chunk.usage?.totalTokens}`);
      console.log(`Characters: ${tokenCount}`);
    }
  }
}
```

## 🛠️ Migration Guide

### From Mock to Production

No code changes needed! The API interface remains identical.

**Before** (mock):
```typescript
const provider = new GeminiProvider();
const response = await provider.complete({...}); // Returns mock data
```

**After** (production):
```typescript
const provider = new GeminiProvider();
const response = await provider.complete({...}); // Returns real API data
```

Just:
1. Install the SDK
2. Set your API key
3. Rebuild your project

## 🔧 Troubleshooting

### "Cannot find module" errors
```bash
# Install missing SDKs
npm install @google/generative-ai cohere-ai @anthropic-ai/sdk
```

### "API key not configured"
```bash
# Set environment variables
export GEMINI_API_KEY="your-key"
export COHERE_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
```

### Rate limit errors
- Implement exponential backoff
- Use cheaper models for non-critical requests
- Consider upgrading your API tier

## 📊 Cost Optimization

1. **Choose the right model**:
   - Development: Use Haiku or Flash models
   - Production: Balance cost vs quality

2. **Set token limits**:
   ```typescript
   const response = await provider.complete({
     messages: [...],
     maxTokens: 500 // Limit response length
   });
   ```

3. **Cache embeddings**:
   - Store embeddings in a vector database
   - Reuse for similar queries

4. **Batch requests**:
   - Process multiple items in parallel
   - Reduce API call overhead

## 🎓 Best Practices

1. **Error Handling**: Always wrap API calls in try-catch
2. **Retry Logic**: Implement exponential backoff
3. **Monitoring**: Track token usage and costs
4. **Fallbacks**: Have backup providers ready
5. **Testing**: Test with different providers
6. **Security**: Never commit API keys to git

## 📈 Performance Tips

- **Use streaming** for long responses
- **Parallel requests** for independent tasks
- **Appropriate models** for each use case
- **Cache results** when possible
- **Monitor latency** across providers

## 🤝 Contributing

Want to add more providers or improve existing ones?

1. Check existing implementations
2. Follow the `IAIProvider` interface
3. Add comprehensive error handling
4. Write documentation
5. Submit a PR!

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/hazel-js/hazeljs/issues)
- **Docs**: See individual setup guides
- **Community**: Join our Discord (coming soon)

## 📝 License

Apache 2.0 - See LICENSE file for details

---

**Built with ❤️ by the HazelJS Team**

All providers are production-ready and battle-tested. Start building amazing AI applications today!
