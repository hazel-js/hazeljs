# Cohere AI Provider - Production Setup

The Cohere provider is now **production-ready** with full Cohere AI SDK integration.

## Installation

```bash
npm install cohere-ai
```

## Configuration

Set your Cohere API key as an environment variable:

```bash
export COHERE_API_KEY="your-api-key-here"
```

Or pass it directly to the provider:

```typescript
import { CohereProvider } from '@hazeljs/ai';

const cohere = new CohereProvider('your-api-key-here');
```

## Get Your API Key

1. Visit [Cohere Dashboard](https://dashboard.cohere.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key or copy an existing one

## Features

### ✅ Text Completion

```typescript
const response = await cohere.complete({
  messages: [
    { role: 'user', content: 'Explain machine learning in simple terms' }
  ],
  model: 'command-r-plus',
  temperature: 0.7,
  maxTokens: 1000
});

console.log(response.content);
console.log(response.usage); // Token usage statistics
```

### ✅ Streaming Responses

```typescript
const stream = cohere.streamComplete({
  messages: [
    { role: 'user', content: 'Write a creative story about AI' }
  ],
  model: 'command-r'
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
const embeddings = await cohere.embed({
  input: [
    'Natural language processing is a branch of AI',
    'Deep learning models use neural networks'
  ],
  model: 'embed-english-v3.0'
});

console.log(embeddings.embeddings); // Array of 1024-dimensional vectors
console.log(embeddings.usage); // Token usage
```

### ✅ Document Reranking (Unique to Cohere!)

Cohere's reranking is perfect for RAG applications to improve retrieval quality:

```typescript
const documents = [
  'Python is a programming language',
  'JavaScript is used for web development',
  'Machine learning uses algorithms to learn from data',
  'React is a JavaScript library'
];

const reranked = await cohere.rerank(
  'What is machine learning?',
  documents,
  2, // Top 2 results
  'rerank-english-v3.0'
);

reranked.forEach(result => {
  console.log(`Score: ${result.score.toFixed(3)} - ${result.document}`);
});
// Output:
// Score: 0.987 - Machine learning uses algorithms to learn from data
// Score: 0.234 - Python is a programming language
```

### ✅ Availability Check

```typescript
const isAvailable = await cohere.isAvailable();
console.log('Cohere available:', isAvailable);
```

## Supported Models

### Text Generation
- **command-r-plus** - Most powerful model for complex reasoning tasks
- **command-r** - Balanced performance and cost, great for most use cases
- **command** - Standard text generation model
- **command-light** - Fast, cost-effective model for simple tasks
- **command-nightly** - Latest experimental features

### Embeddings
- **embed-english-v3.0** - English text embeddings (1024 dimensions)
- **embed-multilingual-v3.0** - Multilingual embeddings (1024 dimensions)
- **embed-english-light-v3.0** - Faster English embeddings
- **embed-multilingual-light-v3.0** - Faster multilingual embeddings

### Reranking
- **rerank-english-v3.0** - English document reranking
- **rerank-multilingual-v3.0** - Multilingual document reranking

## Error Handling

The provider includes comprehensive error handling:

```typescript
try {
  const response = await cohere.complete({
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  console.error('Cohere API error:', error.message);
  // Handle rate limits, invalid API keys, etc.
}
```

## Usage with HazelJS Framework

### In Controllers

```typescript
import { Controller, Get, Post, Body, Injectable } from '@hazeljs/core';
import { CohereProvider } from '@hazeljs/ai';

@Injectable()
@Controller('/api/ai')
export class AIController {
  private cohere: CohereProvider;

  constructor() {
    this.cohere = new CohereProvider();
  }

  @Post('/generate')
  async generate(@Body() body: { prompt: string }) {
    const response = await this.cohere.complete({
      messages: [
        { role: 'user', content: body.prompt }
      ],
      model: 'command-r',
      temperature: 0.8
    });

    return { text: response.content };
  }

  @Post('/rerank')
  async rerank(@Body() body: { query: string; documents: string[] }) {
    const results = await this.cohere.rerank(
      body.query,
      body.documents,
      5
    );

    return { results };
  }
}
```

### RAG Application with Reranking

```typescript
import { CohereProvider } from '@hazeljs/ai';
import { RAGService } from '@hazeljs/rag';

class SmartRAG {
  private cohere: CohereProvider;
  private rag: RAGService;

  constructor() {
    this.cohere = new CohereProvider();
    this.rag = new RAGService(/* config */);
  }

  async search(query: string) {
    // Step 1: Initial retrieval (get more candidates)
    const candidates = await this.rag.search(query, { topK: 20 });
    
    // Step 2: Rerank with Cohere for better relevance
    const reranked = await this.cohere.rerank(
      query,
      candidates.map(c => c.content),
      5 // Get top 5 after reranking
    );

    // Step 3: Use reranked results for generation
    const context = reranked.map(r => r.document).join('\n\n');
    
    const response = await this.cohere.complete({
      messages: [
        { role: 'system', content: 'Answer based on the context provided.' },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
      ],
      model: 'command-r-plus'
    });

    return {
      answer: response.content,
      sources: reranked
    };
  }
}
```

### With Agent Runtime

```typescript
import { AgentRuntime } from '@hazeljs/agent';
import { CohereProvider } from '@hazeljs/ai';

const cohere = new CohereProvider();

const llmProvider = {
  chat: async (options: any) => {
    const response = await cohere.complete({
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

Cohere API has the following limits:

- **Trial tier**: Limited requests per minute
- **Production tier**: Higher limits based on your plan
- **Enterprise**: Custom limits

Monitor your usage in the [Cohere Dashboard](https://dashboard.cohere.com/).

## Best Practices

1. **Choose the Right Model**:
   - Use `command-r-plus` for complex reasoning and analysis
   - Use `command-r` for balanced performance (recommended for most cases)
   - Use `command-light` for simple, fast responses

2. **Leverage Reranking**: 
   - Always use reranking for RAG applications
   - Retrieve 2-3x more candidates than needed, then rerank
   - Reranking significantly improves retrieval quality

3. **Optimize Embeddings**:
   - Use `embed-english-v3.0` for English-only content
   - Use `embed-multilingual-v3.0` for multilingual content
   - Consider light models for faster processing

4. **Handle Errors Gracefully**:
   - Implement retry logic with exponential backoff
   - Monitor rate limits and adjust request frequency
   - Log errors for debugging

5. **Monitor Token Usage**:
   - Track `response.usage` to optimize costs
   - Set appropriate `maxTokens` limits
   - Use streaming for long responses

## Cohere-Specific Advantages

### 1. Superior Reranking
Cohere's reranking models are industry-leading for improving search relevance in RAG applications.

### 2. Multilingual Support
Excellent multilingual capabilities across generation and embeddings.

### 3. Enterprise Features
- Fine-tuning support
- Custom models
- Dedicated support

### 4. Cost-Effective
Competitive pricing with excellent performance/cost ratio.

## Migration from Mock Implementation

If you were using the previous mock implementation, no code changes are needed! Simply:

1. Install `cohere-ai`
2. Set your `COHERE_API_KEY`
3. Rebuild your project

The provider will automatically use the real API instead of mock responses.

## Troubleshooting

### "API key not configured"
- Ensure `COHERE_API_KEY` is set in your environment
- Or pass the API key directly to the constructor

### "Cannot find module 'cohere-ai'"
- Run `npm install cohere-ai` in your project
- Rebuild with `npm run build`

### Rate limit errors
- Implement retry logic with exponential backoff
- Consider upgrading to a higher tier for more requests
- Use `command-light` for less critical requests

### Reranking returns unexpected results
- Ensure documents array is not empty
- Check that `topN` is less than or equal to documents length
- Verify the query is relevant to the documents

## Performance Tips

1. **Batch Embeddings**: Process multiple texts in a single API call
2. **Cache Results**: Cache embeddings and reranking results when possible
3. **Use Streaming**: For long-form content generation
4. **Parallel Requests**: Make independent API calls in parallel
5. **Model Selection**: Use lighter models when appropriate

## Example: Complete RAG Pipeline

```typescript
import { CohereProvider } from '@hazeljs/ai';

class ProductionRAG {
  private cohere: CohereProvider;

  constructor() {
    this.cohere = new CohereProvider();
  }

  async answer(question: string, documents: string[]) {
    // 1. Embed the question
    const questionEmbedding = await this.cohere.embed({
      input: question,
      model: 'embed-english-v3.0'
    });

    // 2. Find similar documents (simplified - use vector DB in production)
    const candidates = documents.slice(0, 20);

    // 3. Rerank for better relevance
    const reranked = await this.cohere.rerank(
      question,
      candidates,
      5,
      'rerank-english-v3.0'
    );

    // 4. Generate answer with context
    const context = reranked.map(r => r.document).join('\n\n');
    
    const response = await this.cohere.complete({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Answer questions based on the provided context.'
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`
        }
      ],
      model: 'command-r-plus',
      temperature: 0.3
    });

    return {
      answer: response.content,
      sources: reranked,
      usage: response.usage
    };
  }
}
```

## Resources

- [Cohere Documentation](https://docs.cohere.com/)
- [Cohere Dashboard](https://dashboard.cohere.com/)
- [Pricing Information](https://cohere.com/pricing)
- [Model Comparison](https://docs.cohere.com/docs/models)
- [Reranking Guide](https://docs.cohere.com/docs/reranking)
- [RAG Best Practices](https://docs.cohere.com/docs/retrieval-augmented-generation-rag)
