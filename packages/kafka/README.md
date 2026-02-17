# @hazeljs/kafka

**Kafka Module for HazelJS - Produce, Consume, and Stream Processing**

Apache Kafka integration for HazelJS with decorator-based consumers, producer service, and lightweight stream processing.

[![npm version](https://img.shields.io/npm/v/@hazeljs/kafka.svg)](https://www.npmjs.com/package/@hazeljs/kafka)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Produce** - Publish messages to Kafka topics via `KafkaProducerService`
- **Consume** - Decorator-driven consumers with `@KafkaConsumer` and `@KafkaSubscribe`
- **Stream Processing** - Lightweight `KafkaStreamProcessor` for consume-transform-produce pipelines
- **Graceful Shutdown** - Clean disconnect on application shutdown
- **TypeScript** - Full type safety with KafkaJS

## Installation

```bash
npm install @hazeljs/kafka
```

## Quick Start

### 1. Configure KafkaModule

```typescript
// app.module.ts
import { HazelModule } from '@hazeljs/core';
import { KafkaModule } from '@hazeljs/kafka';

@HazelModule({
  imports: [
    KafkaModule.forRoot({
      clientId: 'my-app',
      brokers: ['localhost:9092'],
    }),
  ],
})
export class AppModule {}
```

### 2. Produce Messages

```typescript
import { Injectable } from '@hazeljs/core';
import { KafkaProducerService } from '@hazeljs/kafka';

@Injectable()
export class OrderService {
  constructor(private producer: KafkaProducerService) {}

  async createOrder(data: CreateOrderDto) {
    await this.producer.send('orders', [
      { key: data.id, value: JSON.stringify(data) },
    ]);
    return data;
  }
}
```

### 3. Consume Messages (Decorator-Based)

```typescript
import { Injectable } from '@hazeljs/core';
import { KafkaConsumer, KafkaSubscribe, KafkaMessagePayload } from '@hazeljs/kafka';

@KafkaConsumer({ groupId: 'order-processor' })
@Injectable()
export class OrderConsumer {
  @KafkaSubscribe('orders')
  async handleOrder({ message }: KafkaMessagePayload) {
    const order = JSON.parse(message.value!.toString());
    console.log('Processing order:', order);
  }
}
```

### 4. Register Consumers in Bootstrap

```typescript
// index.ts
import { HazelApp, Container } from '@hazeljs/core';
import { KafkaModule } from '@hazeljs/kafka';
import { AppModule } from './app.module';
import { OrderConsumer } from './order.consumer';

async function bootstrap() {
  const app = new HazelApp(AppModule);

  // Register Kafka consumers
  const container = Container.getInstance();
  const orderConsumer = container.resolve(OrderConsumer);
  if (orderConsumer) {
    await KafkaModule.registerConsumersFromProvider(orderConsumer);
  }

  await app.listen(3000);
}
bootstrap();
```

## Stream Processing

For consume-transform-produce pipelines:

```typescript
import { Container } from '@hazeljs/core';
import { KafkaStreamProcessor } from '@hazeljs/kafka';

const container = Container.getInstance();
const processor = container.resolve(KafkaStreamProcessor);

processor
  .from('raw-events')
  .transform(async (msg) => ({
    value: JSON.stringify({ ...JSON.parse(msg.value!.toString()), enriched: true }),
  }))
  .to('enriched-events')
  .start();
```

## Async Configuration

Use `forRootAsync` with ConfigService:

```typescript
import { ConfigService } from '@hazeljs/config';
import { KafkaModule } from '@hazeljs/kafka';

KafkaModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    clientId: config.get('KAFKA_CLIENT_ID', 'my-app'),
    brokers: (config.get('KAFKA_BROKERS') || 'localhost:9092').toString().split(','),
  }),
  inject: [ConfigService],
})
```

## API Reference

### KafkaProducerService

- `send(topic, messages, options?)` - Send message(s) to a topic
- `sendBatch(batch)` - Send to multiple topics
- `isProducerConnected()` - Check connection status

### Decorators

- `@KafkaConsumer(options)` - Mark class as consumer (groupId required)
- `@KafkaSubscribe(topic, options?)` - Mark method as topic handler
  - `fromBeginning?: boolean` - Read from beginning of topic

### KafkaStreamProcessor

- `from(topic)` - Input topic
- `transform(fn)` - Transform function (message) => output
- `to(topic)` - Output topic
- `withGroupId(id)` - Consumer group ID
- `start()` - Start processing
- `stop()` - Stop processing

## Environment Variables

```
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-app
```

## Requirements

- Apache Kafka broker (>= 0.11.x)
- Node.js >= 14
