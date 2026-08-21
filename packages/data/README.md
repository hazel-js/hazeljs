# @hazeljs/data

Data Processing & ETL for HazelJS - pipelines, schema validation, streaming, data quality, and more.

[![npm version](https://img.shields.io/npm/v/@hazeljs/data.svg)](https://www.npmjs.com/package/@hazeljs/data)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/data)](https://www.npmjs.com/package/@hazeljs/data)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Pipelines** – Declarative ETL with `@Pipeline`, `@Transform`, `@Validate` decorators
- **PipelineRunner** – First-class `source → transform → quality → sink` loop with DLQ + telemetry
- **Schema validation** – Fluent Schema API (string, number, boolean, date, object, array, literal, union) with `.optional()`, `.nullable()`, `.default()`, `.transform()`, `.refine()`, `Infer<T>`, `.toJsonSchema()`
- **Pipeline options** – Conditional steps (`when`), per-step retry, timeout, dead letter queue (DLQ)
- **PipelineBuilder** – Programmatic pipelines with `.branch()`, `.parallel()`, `.catch()`, `.toSchema()`
- **ETL service** – Execute multi-step pipelines with `executeBatch`, `onStepComplete`
- **Stream processing** – StreamService, StreamProcessor with tumbling/sliding/session windows and stream join
- **Built-in transformers** – trim/case/JSON, pick/omit/rename, cast, parseDate, fillna, flatten, explode, hash, dedupe, lookupJoin
- **Data quality** – completeness, notNull, uniqueness, range, pattern, referentialIntegrity, freshness, rowCount, schemaDrift; profile(); anomalies via Z-score / IQR / MAD
- **Data contracts** – ContractRegistry with Schema-aware validation; wired into DataModule
- **Telemetry** – spans, metrics, lineage; configure via `DataModule.forRoot({ telemetry })`
- **Connectors** – Memory, Csv, Http, Jsonl, Postgres (parameterized queries)
- **PII decorators** – @Mask, @Redact, @Encrypt, @Decrypt (nested field paths supported)
- **Test utilities** – SchemaFaker, PipelineTestHarness, MockSource, MockSink
- **Flink helpers** – Optional JobManager REST client + job-graph config generation (does not compile TypeScript transforms to Flink operators)

## Installation

```bash
npm install @hazeljs/data @hazeljs/core
```

## Quick Start

### 1. Import DataModule

```typescript
import { HazelApp } from '@hazeljs/core';
import { DataModule } from '@hazeljs/data';

const app = new HazelApp({
  imports: [DataModule.forRoot()],
});

app.listen(3000);
```

### 2. Define a pipeline with decorators

```typescript
import { Injectable } from '@hazeljs/core';
import {
  Pipeline,
  PipelineBase,
  Transform,
  Validate,
  ETLService,
  Schema,
  Infer,
} from '@hazeljs/data';

const OrderSchema = Schema.object({
  id: Schema.string().min(1),
  customerId: Schema.string().min(1),
  items: Schema.array(
    Schema.object({
      sku: Schema.string().min(1),
      qty: Schema.number().min(1),
      price: Schema.number().min(0),
    })
  ),
  status: Schema.string().oneOf(['pending', 'paid', 'shipped', 'delivered', 'cancelled']),
  createdAt: Schema.string().min(1),
});

type Order = Infer<typeof OrderSchema>;

@Pipeline('order-processing')
@Injectable()
export class OrderProcessingPipeline extends PipelineBase {
  constructor(etlService: ETLService) {
    super(etlService);
  }

  @Transform({ step: 1, name: 'normalize' })
  async normalize(data: unknown): Promise<Order> {
    return { ...(data as Order), status: String((data as Order).status).toLowerCase() };
  }

  @Validate({ step: 2, name: 'validate', schema: OrderSchema })
  async validate(data: Order): Promise<Order> {
    return data;
  }

  @Transform({ step: 3, name: 'enrich' })
  async enrich(data: Order): Promise<Order & { total: number; tax: number }> {
    const items = data.items ?? [];
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const tax = subtotal * 0.1;
    return { ...data, subtotal, tax, total: subtotal + tax };
  }
}
```

### 3. Execute from a controller or service

```typescript
import { Controller, Post, Body, Inject } from '@hazeljs/core';
import { OrderProcessingPipeline } from './pipelines/order-processing.pipeline';

@Controller('data')
export class DataController {
  constructor(@Inject(OrderProcessingPipeline) private pipeline: OrderProcessingPipeline) {}

  @Post('pipeline/orders')
  async processOrder(@Body() body: unknown) {
    const result = await this.pipeline.execute(body);
    return { ok: true, data: result };
  }
}
```

## Schema validation

Build schemas with the fluent API. Full type inference via `Infer<T>`:

```typescript
import { Schema, Infer, SchemaValidator } from '@hazeljs/data';

const UserSchema = Schema.object({
  email: Schema.string().email(),
  name: Schema.string().min(1).max(200),
  age: Schema.number().min(0).max(150),
  role: Schema.string().oneOf(['user', 'admin', 'moderator', 'guest']),
  active: Schema.boolean().default(true),
});

type User = Infer<typeof UserSchema>;

// Validate (throws on failure)
const validator = new SchemaValidator();
const user = validator.validate(UserSchema, rawData);

// Safe validate (returns result)
const result = validator.safeValidate(UserSchema, rawData);
if (result.success) {
  const user = result.data;
} else {
  console.error(result.errors);
}
```

### Schema types and modifiers

| Type                       | Example                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Schema.string()`          | `.email()`, `.url()`, `.min()`, `.max()`, `.uuid()`, `.oneOf()`, `.pattern()`, `.required()`, `.trim()` |
| `Schema.number()`          | `.min()`, `.max()`, `.integer()`, `.positive()`, `.negative()`, `.multipleOf()`                         |
| `Schema.boolean()`         | `.default()`                                                                                            |
| `Schema.date()`            | `.min()`, `.max()`, `.default()`                                                                        |
| `Schema.object({...})`     | `.strict()`, `.pick()`, `.omit()`, `.extend()`                                                          |
| `Schema.array(itemSchema)` | `.min()`, `.max()`, `.nonempty()`                                                                       |
| `Schema.literal(value)`    | Literal values                                                                                          |
| `Schema.union([a, b])`     | Discriminated unions                                                                                    |
| Modifiers                  | `.optional()`, `.nullable()`, `.default()`, `.transform()`, `.refine()`, `.refineAsync()`               |

## Pipeline options

Steps support conditional execution, retry, timeout, and DLQ:

```typescript
@Transform({
  step: 2,
  name: 'enrich',
  when: (data) => (data as { type: string }).type === 'order',
  retry: { attempts: 3, delay: 500, backoff: 'exponential' },
  timeoutMs: 5000,
  dlq: { handler: (item, err, step) => logger.error('DLQ', { item, err, step }) },
})
async enrich(data: unknown) {
  return { ...data, enriched: true };
}
```

## PipelineBuilder (programmatic pipelines)

Build pipelines in code without decorators:

```typescript
import { PipelineBuilder } from '@hazeljs/data';

const pipeline = new PipelineBuilder('orders')
  .addTransform('normalize', (d) => ({
    ...d,
    email: (d as { email: string }).email?.toLowerCase(),
  }))
  .branch(
    'classify',
    (d) => (d as { type: string }).type === 'premium',
    (b) => b.addTransform('enrichPremium', enrichPremium),
    (b) => b.addTransform('enrichStandard', enrichStandard)
  )
  .parallel('enrich', [(d) => ({ ...d, a: 1 }), (d) => ({ ...d, b: 2 })])
  .catch((data, err) => ({ ...data, error: err.message }));

const result = await pipeline.execute(rawData);
```

## Batch and stream processing

```typescript
import { StreamService, StreamProcessor } from '@hazeljs/data';

// Batch
const results = await streamService.processBatch(pipeline, items);

// Streaming with windowing
const processor = new StreamProcessor(etlService);
for await (const batch of processor.tumblingWindow(source, 60_000)) {
  console.log(batch.items, batch.windowStart, batch.windowEnd);
}
// Also: slidingWindow, sessionWindow, joinStreams
```

## Data quality

```typescript
import { QualityService } from '@hazeljs/data';

const qualityService = new QualityService();

qualityService.registerCheck('completeness', qualityService.completeness(['id', 'email']));
qualityService.registerCheck('notNull', qualityService.notNull(['id']));
qualityService.registerCheck('uniqueness', qualityService.uniqueness(['id']));
qualityService.registerCheck('range', qualityService.range('age', { min: 0, max: 120 }));
qualityService.registerCheck('pattern', qualityService.pattern('phone', /^\d{10}$/));
qualityService.registerCheck(
  'ref',
  qualityService.referentialIntegrity('status', ['active', 'inactive'])
);

const report = await qualityService.runChecks('users', records);
const profile = qualityService.profile('users', records);
const anomalies = qualityService.detectAnomalies(records, ['value'], 2);
```

## PII decorators

```typescript
import { Transform, Mask, Redact } from '@hazeljs/data';

@Transform({ step: 1, name: 'sanitize' })
@Mask({ fields: ['email', 'ssn'], showLast: 4 })
sanitize(data: User) {
  return data; // email/ssn already masked
}

@Transform({ step: 2, name: 'redact' })
@Redact({ fields: ['internalId'] })
redact(data: Record<string, unknown>) {
  return data; // internalId removed
}
```

## Test utilities

```typescript
import { SchemaFaker, PipelineTestHarness, MockSource, MockSink } from '@hazeljs/data';

const fake = SchemaFaker.generate(UserSchema);
const many = SchemaFaker.generateMany(UserSchema, 10);

const harness = PipelineTestHarness.create(etlService, pipeline);
const { result, events } = await harness.run(input);
await harness.runAndAssertSuccess(input);

const source = new MockSource([{ x: 1 }]);
const sink = new MockSink();
```

## Built-in transformers

| Transformer                    | Description                               |
| ------------------------------ | ----------------------------------------- |
| `trimString`                   | Trim whitespace from strings              |
| `toLowerCase` / `toUpperCase`  | Case conversion                           |
| `parseJson` / `stringifyJson`  | JSON parsing and serialization            |
| `pick` / `omit` / `renameKeys` | Object key helpers                        |
| `cast`                         | Cast fields to string/number/boolean/date |
| `parseDate`                    | Parse date fields                         |
| `fillna` / `coalesce`          | Fill null/undefined defaults              |
| `flatten`                      | Flatten nested objects                    |
| `explode`                      | Explode array field into rows             |
| `hash`                         | SHA-256 hash fields                       |
| `dedupe`                       | Deduplicate record arrays by keys         |
| `lookupJoin`                   | Enrich from Map / lookup table            |

## PipelineRunner (source → sink)

```typescript
import { PipelineRunner, MemorySource, MemorySink, cast, fillna } from '@hazeljs/data';

const runner = new PipelineRunner(etlService, qualityService);
const result = await runner.run({
  source: new MemorySource(rawRows),
  sink: new MemorySink(),
  transform: (row) => fillna({ status: 'unknown' })(cast({ amount: 'number' })(row)),
  qualityDataset: 'orders',
  pipelineName: 'orders-etl',
});
```

## Flink configuration (optional)

Flink support is a **JobManager REST client** plus job-graph / config generation for manual JAR deployment.
It does **not** compile `@Transform` methods into Flink operators.

```typescript
DataModule.forRoot({
  flink: {
    url: process.env.FLINK_REST_URL ?? 'http://localhost:8081',
    timeout: 30000,
  },
  telemetry: { enabled: true, serviceName: 'orders', lineage: true },
});
```

## Example

See [hazeljs-data-starter](../../../hazeljs-data-starter) for a full example with order and user pipelines, PipelineBuilder, PII decorators, quality profiling, anomaly detection, and REST API.

## Links

- [Documentation](https://hazeljs.ai/docs/packages/data)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Homepage](https://hazeljs.ai)
