# @hazeljs/observability

**Production-grade observability for AI agents and LLM flows.**

Trace complex reasoning loops, monitor per-request LLM costs, and debug agentic workflows with native OpenTelemetry support. One decorator, one provider. Ship observable AI features without the manual instrumentation.

[![npm version](https://img.shields.io/npm/v/@hazeljs/observability.svg)](https://www.npmjs.com/package/@hazeljs/observability)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/observability)](https://www.npmjs.com/package/@hazeljs/observability)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🕵️ **Native Tracing** - Auto-instrumentation via `@Trace()` decorator
- 📊 **Cost Tracking** - Monitor LLM token usage and estimated API costs in real-time
- 🌐 **OpenTelemetry** - Built on industry-standard OTel for vendor neutrality (Jaeger, Honeycomb, etc.)
- ⚡ **Zero Overhead** - Asynchronous span processing that never blocks your agent execution
- 🎯 **Type-Safe Spans** - Rich metadata capture with full TypeScript support
- 🏗️ **Distributed Context** - Trace flows across multiple agents and services

## Installation

```bash
npm install @hazeljs/observability
```

### Peer Dependencies

Install the OpenTelemetry API and SDK if not already present:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/resources @opentelemetry/semantic-conventions
```

## Quick Start

### 1. Initialize the Provider

Initialize the `OpenTelemetryProvider` in your application's entry point:

```typescript
import { OpenTelemetryProvider } from '@hazeljs/observability';

const provider = new OpenTelemetryProvider({
  serviceName: 'my-ai-agent',
  endpoint: 'http://localhost:4318/v1/traces', // OTLP endpoint
});

provider.initialize();
```

### 2. Trace Methods with @Trace()

Simply drop the `@Trace()` decorator on any synchronous or asynchronous method:

```typescript
import { Trace } from '@hazeljs/observability';
import { Injectable } from '@hazeljs/core';

@Injectable()
export class FinancialAgent {
  @Trace('analyze-portfolio')
  async analyzePortfolio(data: any) {
    // This method call is now automatically captured as a span
    // including duration, status, and metadata.
    return await this.performHeavyAnalysis(data);
  }
}
```

## Cost & Token Tracking

Integrate LLM cost tracking directly into your traces:

```typescript
import { Trace, useObservability } from '@hazeljs/observability';

class AIService {
  @Trace('llm-completion')
  async complete(prompt: string) {
    const { trackCost } = useObservability();
    const response = await this.llm.generate(prompt);

    // Capture token usage and cost as span attributes
    trackCost('gpt-4o', response.usage.inputTokens, response.usage.outputTokens);

    return response;
  }
}
```

## Architecture

The observability package follows the A2A (Agent-to-Agent) and OTel specifications to ensure your traces are compatible with the broader ecosystem.

<MermaidDiagram chart={`graph TD
    A["@Trace() Decorator"] --> B["Observability Service"]
    B --> C["OpenTelemetry Provider"]
    C --> D["OTLP Exporter"]
    D --> E["Observability Platform<br/>(Jaeger, Honeycomb, Datadog)"]
    
    style A fill:#3b82f6,color:#fff
    style B fill:#6366f1,color:#fff
    style C fill:#10b981,color:#fff
`} />

## API Reference

### OpenTelemetryProvider

```typescript
class OpenTelemetryProvider {
  constructor(config: {
    serviceName: string;
    endpoint?: string;
    headers?: Record<string, string>;
  });
  initialize(): void;
  shutdown(): Promise<void>;
}
```

### @Trace Decorator

```typescript
@Trace(spanName?: string, options?: TraceOptions)
```

**TraceOptions:**
- `attributes`: Static attributes to add to the span.
- `captureArgs`: Whether to capture method arguments (default: `false`).
- `captureResult`: Whether to capture method return value (default: `false`).

## Examples

See the [examples](../../example/src/observability) directory for complete working examples with Jaeger and Honeycomb.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/observability)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Discord](https://discord.gg/xe495BvE)
