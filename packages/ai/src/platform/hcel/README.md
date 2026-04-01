# HCEL - HazelJS Composable Expression Language

**HCEL** is a TypeScript-native composable expression language for AI operations that goes beyond LCEL's pipe operator with full type safety, built-in observability, and intelligent execution.

## 🚀 Quick Start

```typescript
import { HazelAI } from '@hazeljs/ai';

const ai = HazelAI.create({
  defaultProvider: 'openai',
  model: 'gpt-4o',
});

// Simple composition
const result = await ai.hazel
  .prompt('Analyze: {topic}')
  .rag('knowledge-base')
  .agent('analyst')
  .ml('sentiment')
  .execute();

// Streaming
for await (const chunk of ai.hazel
  .prompt('Summarize this article')
  .rag('docs')
  .stream()) {
  console.log(chunk);
}
```

## ✨ Key Features

### 🎯 TypeScript-Native
- **Full type inference** - No `any` types like LCEL
- **Generic constraints** - `HCELBuilder<TInput, TOutput>`
- **Auto-completion** - IDE knows available methods at each step
- **Compile-time validation** - Catch errors before runtime

### 🔗 Fluent Composition
```typescript
// Natural chaining with full IntelliSense
const result = await ai.hazel
  .prompt('Summarize this article about {topic}')
  .system('You are a helpful assistant')
  .model('gpt-4')
  .temperature(0.3)
  .rag('knowledge-base')
  .ml('sentiment')
  .execute();
```

### 🧠 Intelligent Context Propagation
```typescript
// Context automatically flows between operations
const result = await ai.hazel
  .context({ userId: '123', sessionId: 'abc' })
  .prompt('Analyze user feedback')
  .rag('feedback-db')  // Automatically gets context
  .agent('support')   // Context-aware responses
  .execute();
```

### 📊 Built-in Observability
```typescript
// Every operation is automatically traced
const result = await ai.hazel
  .observe((event) => {
    console.log(`Operation: ${event.type}, Duration: ${event.timestamp}`);
  })
  .prompt('Process this data')
  .ml('classify')
  .execute();
```

### ⚡ Adaptive Execution
```typescript
// Automatically optimizes execution strategy
const result = await ai.hazel
  .adaptive()  // Chooses parallel vs sequential
  .parallel(
    ai.hazel.prompt('Summarize'),
    ai.hazel.ml('sentiment')
  )
  .execute();
```

## 📖 Core Operations

### Prompt Operations
```typescript
// Basic prompt
await ai.hazel.prompt('What is HazelJS?').execute();

// With configuration
await ai.hazel
  .prompt('Analyze: {topic}')
  .model('gpt-4')
  .temperature(0.7)
  .system('You are an expert analyst')
  .execute();
```

### RAG Operations
```typescript
// Simple RAG
await ai.hazel.rag('documentation').ask('What is HazelJS?');

// With options
await ai.hazel
  .rag('knowledge-base', { topK: 5, strategy: 'hybrid' })
  .execute();
```

### Agent Operations
```typescript
// Execute agent
await ai.hazel.agent('researcher', 'Analyze market trends');

// Multi-agent pipeline
await ai.hazel
  .agent('data-collector')
  .agent('analyst')
  .agent('reporter')
  .execute();
```

### ML Operations
```typescript
// Sentiment analysis
await ai.hazel.ml('sentiment').execute('I love this product!');

// Classification
await ai.hazel
  .ml('classify', { labels: ['urgent', 'normal', 'low'] })
  .execute('This needs immediate attention');

// Scoring
await ai.hazel
  .ml('score', { 
    items: [{ id: '1', text: 'Great product' }],
    criteria: 'Quality'
  })
  .execute();
```

## 🔧 Advanced Composition

### Parallel Operations
```typescript
const result = await ai.hazel
  .parallel(
    ai.hazel.prompt('Summarize this text'),
    ai.hazel.ml('sentiment'),
    ai.hazel.rag('additional-context')
  )
  .execute();
```

### Conditional Operations
```typescript
const result = await ai.hazel
  .prompt('Analyze this text')
  .conditional((result) => result.confidence > 0.8)
  .agent('expert-reviewer')
  .execute();
```

### Workflow Composition
```typescript
const workflow = ai.hazel
  .prompt('Extract key information')
  .ml('classify')
  .conditional((result) => result.label === 'urgent')
  .agent('urgent-handler')
  .adaptive();

const result = await workflow.execute(document);
```

## 🎛️ Configuration

### Chain Configuration
```typescript
const chain = ai.hazel
  .prompt('Process this')
  .config({
    adaptive: true,
    retryPolicy: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2
    },
    observability: {
      trace: true,
      metrics: true,
      events: true
    }
  });
```

### Context Management
```typescript
const result = await ai.hazel
  .context({
    userId: 'user-123',
    sessionId: 'session-456',
    metadata: { source: 'web', version: '2.0' }
  })
  .prompt('Help me with this request')
  .execute();
```

## 🔄 Migration from Existing APIs

### From Individual HazelAI Calls
```typescript
// Before
const chat = await ai.chat('Hello');
const sentiment = await ai.sentiment(chat);
const rag = await ai.rag.ask('Query');

// After with HCEL
const result = await ai.hazel
  .prompt('Hello')
  .ml('sentiment')
  .rag('docs')
  .execute();
```

### From ChatBuilder
```typescript
// Before
const response = await ai.chat('Hello')
  .model('gpt-4')
  .temperature(0.7)
  .send();

// After with HCEL
const response = await ai.hazel
  .prompt('Hello')
  .model('gpt-4')
  .temperature(0.7)
  .execute();
```

## 🧪 Testing HCEL Chains

```typescript
import { HazelAI } from '@hazeljs/ai';

describe('My AI Chain', () => {
  let ai: HazelAI;

  beforeEach(() => {
    ai = HazelAI.create();
  });

  it('should compose operations correctly', async () => {
    const result = await ai.hazel
      .prompt('Test message')
      .ml('sentiment')
      .execute();
    
    expect(result).toBeDefined();
  });

  it('should handle streaming', async () => {
    const chunks = [];
    for await (const chunk of ai.hazel
      .prompt('Stream this')
      .stream()) {
      chunks.push(chunk);
    }
    
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

## 🔍 Debugging

### Chain Summary
```typescript
const chain = ai.hazel
  .prompt('Analyze')
  .ml('sentiment')
  .rag('docs');

console.log(chain.getSummary());
// Output: { operationCount: 3, operations: ['prompt', 'ml', 'rag'], config: {} }
```

### Operation Inspection
```typescript
const operations = chain.getOperations();
operations.forEach(op => {
  console.log(`${op.type}: ${op.id}`);
});
```

### Event Observation
```typescript
await ai.hazel
  .observe((event) => {
    console.log(`${event.type}: ${JSON.stringify(event.data)}`);
  })
  .prompt('Test')
  .execute();
```

## 🚦 Error Handling

```typescript
try {
  const result = await ai.hazel
    .prompt('Process this')
    .rag('non-existent-source')
    .execute();
} catch (error) {
  if (error.message.includes('non-existent-source')) {
    // Handle RAG source not found
  } else {
    // Handle other errors
  }
}
```

## 🎯 Best Practices

1. **Start Simple**: Begin with basic chains and add complexity gradually
2. **Use Types**: Leverage TypeScript generics for better type safety
3. **Add Context**: Use context for user sessions and tracing
4. **Observe Events**: Add observers for debugging and monitoring
5. **Handle Errors**: Always wrap chains in try-catch blocks
6. **Test Chains**: Unit test individual operations and full chains

## 🔮 Future Enhancements

- **Template Literals**: Embed operations directly in template strings
- **Visual Builder**: Web-based chain composition interface
- **Chain Templates**: Reusable chain templates for common patterns
- **Performance Optimization**: Automatic chain optimization and caching
- **Advanced Routing**: Dynamic operation routing based on input characteristics

## 📚 Examples

See the `/examples` directory for complete working examples:

- `hcel-demo.ts` - Comprehensive HCEL demonstration
- `unified-platform-example.ts` - Integration with existing HazelAI features

## 🤝 Contributing

HCEL is part of the HazelJS ecosystem. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

---

**HCEL**: Where TypeScript meets AI composition - Beyond LCEL, built for HazelJS.
