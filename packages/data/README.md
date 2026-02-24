# @hazeljs/data

Data Processing & ETL for HazelJS - pipelines, schema validation, streaming, and data quality.

[![npm version](https://img.shields.io/npm/v/@hazeljs/data.svg)](https://www.npmjs.com/package/@hazeljs/data)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/data)](https://www.npmjs.com/package/@hazeljs/data)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Pipelines** – Declarative ETL with `@Pipeline`, `@Transform`, `@Validate` decorators
- **Schema validation** – Fluent Schema API (string, number, object, array, email, oneOf)
- **ETL service** – Execute multi-step pipelines with ordering and error handling
- **Stream processing** – StreamBuilder, StreamProcessor for batch and streaming workloads
- **Built-in transformers** – trimString, toLowerCase, parseJson, pick, omit, renameKeys
- **Data quality** – QualityService for completeness, notNull, and custom checks
- **Flink integration** – Optional Apache Flink deployment for distributed stream processing

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
} from '@hazeljs/data';

const OrderSchema = Schema.object()
  .prop('id', Schema.string().required())
  .prop('customerId', Schema.string().required())
  .prop('status', Schema.string().oneOf(['pending', 'paid', 'shipped', 'delivered', 'cancelled']))
  .prop('items', Schema.array().items(Schema.object()
    .prop('sku', Schema.string().minLength(1))
    .prop('qty', Schema.number().min(1))
    .prop('price', Schema.number().min(0))
  ))
  .required();

@Pipeline('order-processing')
@Injectable()
export class OrderProcessingPipeline extends PipelineBase {
  constructor(etlService: ETLService) {
    super(etlService);
  }

  @Transform({ step: 1, name: 'normalize' })
  async normalize(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      ...data,
      status: String(data.status).toLowerCase(),
    };
  }

  @Validate({ step: 2, schema: OrderSchema })
  async validate(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return data;
  }

  @Transform({ step: 3, name: 'enrich' })
  async enrich(data: Record<string, unknown> & { items?: { qty: number; price: number }[] }): Promise<Record<string, unknown>> {
    const items = data.items ?? [];
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const tax = subtotal * 0.1;
    return {
      ...data,
      subtotal,
      tax,
      total: subtotal + tax,
      processedAt: new Date().toISOString(),
    };
  }
}
```

### 3. Execute from a controller or service

```typescript
import { Controller, Post, Body, Inject } from '@hazeljs/core';
import { OrderProcessingPipeline } from './pipelines/order-processing.pipeline';

@Controller('data')
export class DataController {
  constructor(
    @Inject(OrderProcessingPipeline) private pipeline: OrderProcessingPipeline
  ) {}

  @Post('pipeline/orders')
  async processOrder(@Body() body: unknown) {
    const result = await this.pipeline.execute(body);
    return { ok: true, data: result };
  }
}
```

## Batch processing with StreamService

Process arrays through pipelines in batches:

```typescript
import { StreamService } from '@hazeljs/data';

const streamService = new StreamService(etlService);
const results = await streamService.processBatch(OrderProcessingPipeline, orders);
```

## Schema validation

Build schemas with the fluent API:

```typescript
import { Schema } from '@hazeljs/data';

const UserSchema = Schema.object()
  .prop('email', Schema.string().format('email').required())
  .prop('name', Schema.string().minLength(1).maxLength(200))
  .prop('age', Schema.number().min(0).max(150))
  .prop('role', Schema.string().oneOf(['user', 'admin', 'moderator', 'guest']))
  .required();

const validator = new SchemaValidator();
const { value, error } = validator.validate(UserSchema, rawData);
```

## Data quality checks

```typescript
import { QualityService } from '@hazeljs/data';

const qualityService = new QualityService();
const report = await qualityService.check(records, {
  completeness: ['id', 'email', 'createdAt'],
  notNull: ['id', 'status'],
});
```

## Flink configuration (optional)

For distributed stream processing with Apache Flink:

```typescript
DataModule.forRoot({
  flink: {
    url: process.env.FLINK_REST_URL ?? 'http://localhost:8081',
    timeout: 30000,
  },
});
```

## Built-in transformers

| Transformer | Description |
|-------------|-------------|
| `trimString` | Trim whitespace from strings |
| `toLowerCase` / `toUpperCase` | Case conversion |
| `parseJson` / `stringifyJson` | JSON parsing and serialization |
| `pick` | Select specific keys from objects |
| `omit` | Remove specific keys from objects |
| `renameKeys` | Rename object keys |

## Example

See [hazeljs-data-starter](../../../hazeljs-data-starter) for a full example with order and user pipelines, REST API, and quality reports.

## Links

- [Documentation](https://hazeljs.com/docs/packages/data)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Homepage](https://hazeljs.com)
