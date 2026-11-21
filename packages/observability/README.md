# @hazeljs/observability

**Production-grade observability for AI agents and LLM flows.**

Trace agent loops, monitor per-request LLM costs, and export spans over OpenTelemetry. Local day-2 debug stays on Inspector; Studio/experiment UX is bring-your-own (Langfuse, Braintrust) via OTLP.

[![npm version](https://img.shields.io/npm/v/@hazeljs/observability.svg)](https://www.npmjs.com/package/@hazeljs/observability)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/observability)](https://www.npmjs.com/package/@hazeljs/observability)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Native tracing** — `@Trace()` decorator on agent/tool methods
- **Cost tracking** — LLM token usage as span attributes
- **OpenTelemetry** — vendor-neutral OTLP (Jaeger, Honeycomb, Langfuse, Braintrust, …)
- **Auth headers** — `otlpHeaders` for partner backends that require Basic/Bearer auth
- **Type-safe spans** — TypeScript-first metadata

HazelJS does **not** ship a Mastra-style Studio. Use [Inspector](https://hazeljs.ai/docs/packages/inspector) for local Agent OS timelines and [CI eval](https://hazeljs.ai/docs/packages/eval) for deploy gates. For playgrounds and experiments, see [Observability partners](https://hazeljs.ai/docs/guides/observability-partners).

## Installation

```bash
npm install @hazeljs/observability
```

### Peer Dependencies

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/exporter-trace-otlp-http
```

## Quick Start

### 1. Initialize the Provider

```typescript
import { OpenTelemetryProvider } from '@hazeljs/observability';

const provider = new OpenTelemetryProvider({
  serviceName: 'my-ai-agent',
  otlpEndpoint: 'http://localhost:4318/v1/traces',
});

await provider.start();
```

### 2. Export to Langfuse / Braintrust

```typescript
const auth = Buffer.from(
  `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`
).toString('base64');

const provider = new OpenTelemetryProvider({
  serviceName: 'support-agent',
  otlpEndpoint: 'https://cloud.langfuse.com/api/public/otel/v1/traces',
  otlpHeaders: {
    Authorization: `Basic ${auth}`,
    'x-langfuse-ingestion-version': '4',
  },
});

await provider.start();
```

Braintrust example:

```typescript
new OpenTelemetryProvider({
  serviceName: 'support-agent',
  otlpEndpoint: 'https://api.braintrust.dev/otel/v1/traces',
  otlpHeaders: {
    Authorization: `Bearer ${process.env.BRAINTRUST_API_KEY}`,
    'x-bt-parent': `project_name:${process.env.BRAINTRUST_PROJECT}`,
  },
});
```

No first-party `@langfuse/*` / `@braintrust/*` dependencies — OTLP only. You may attach vendor span processors yourself if your team already uses those SDKs.

### 3. Trace Methods with `@Trace()`

```typescript
import { Trace } from '@hazeljs/observability';
import { Injectable } from '@hazeljs/core';

@Injectable()
export class FinancialAgent {
  @Trace('analyze-portfolio')
  async analyzePortfolio(data: unknown) {
    return await this.performHeavyAnalysis(data);
  }
}
```

## Cost & Token Tracking

```typescript
provider.trackCost('gpt-4o', response.usage.inputTokens, response.usage.outputTokens);
```

Attaches `llm.model`, `llm.usage.prompt_tokens`, `llm.usage.completion_tokens`, and `llm.usage.total_tokens` on the active span.

## API Reference

### `ObservabilityConfig`

| Field          | Type                      | Description                            |
| -------------- | ------------------------- | -------------------------------------- |
| `serviceName`  | `string`                  | Service name in your tracing backend   |
| `otlpEndpoint` | `string?`                 | Full OTLP HTTP traces URL              |
| `otlpHeaders`  | `Record<string, string>?` | Auth / vendor headers                  |
| `logPrompts`   | `boolean?`                | Log prompts on spans (default `false`) |

### `OpenTelemetryProvider`

```typescript
class OpenTelemetryProvider {
  constructor(config: ObservabilityConfig);
  start(): Promise<void>;
  stop(): Promise<void>;
  getTracer(name: string): Tracer;
  trackCost(model: string, promptTokens: number, completionTokens: number): void;
}
```

### `@Trace` Decorator

```typescript
@Trace(spanName?: string, options?: TraceOptions)
```

## Testing

```bash
npm test
```

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/observability)
- [Observability partners](https://hazeljs.ai/docs/guides/observability-partners)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Discord](https://discord.gg/PxNBPzvQk7)
