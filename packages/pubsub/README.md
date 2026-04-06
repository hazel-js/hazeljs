# @hazeljs/pubsub

**Google Cloud Pub/Sub Module for HazelJS - Publish, Subscribe, and Decorator-Based Consumers**

Google Cloud Pub/Sub integration for HazelJS with decorator-based subscriptions, publisher service, and explicit `ack()` / `nack()` control.

[![npm version](https://img.shields.io/npm/v/@hazeljs/pubsub.svg)](https://www.npmjs.com/package/@hazeljs/pubsub)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/pubsub)](https://www.npmjs.com/package/@hazeljs/pubsub)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Publish** - Send messages to Pub/Sub topics with `PubSubPublisherService`
- **Consume** - Decorator-driven consumers via `@PubSubConsumer` and `@PubSubSubscribe`
- **Ack/Nack control** - Explicit message acknowledgement APIs in handler payload
- **Auto behavior** - Default `ack` on success and `nack` on error, overridable globally or per-subscription
- **Subscription bootstrap** - Optional auto-creation of subscriptions (with topic)
- **TypeScript** - Typed payload contracts and module options

## Installation

```bash
npm install @hazeljs/pubsub
```

## Quick Start

### 1. Configure PubSubModule

```typescript
import { HazelModule } from '@hazeljs/core';
import { PubSubModule } from '@hazeljs/pubsub';

@HazelModule({
  imports: [
    PubSubModule.forRoot({
      projectId: process.env.GCP_PROJECT_ID,
    }),
  ],
})
export class AppModule {}
```

### 2. Publish Messages

```typescript
import { Injectable } from '@hazeljs/core';
import { PubSubPublisherService } from '@hazeljs/pubsub';

@Injectable()
export class OrderService {
  constructor(private readonly publisher: PubSubPublisherService) {}

  async createOrder(order: { id: string; total: number }) {
    await this.publisher.publishJson('orders-topic', order, {
      attributes: { source: 'api' },
    });
  }
}
```

### 3. Consume Messages (Decorator-Based)

```typescript
import { Injectable } from '@hazeljs/core';
import {
  PubSubConsumer,
  PubSubSubscribe,
  PubSubSubscriptionHandlerPayload,
} from '@hazeljs/pubsub';

@PubSubConsumer({ ackOnSuccess: true, nackOnError: true, parseJson: true })
@Injectable()
export class OrderConsumer {
  @PubSubSubscribe({
    subscription: 'orders-subscription',
    topic: 'orders-topic',
    autoCreateSubscription: true,
  })
  async handleOrder(payload: PubSubSubscriptionHandlerPayload<{ id: string; total: number }>) {
    // process order payload
    console.log(payload.data.id, payload.data.total);

    // Optional manual control:
    // payload.ack();
    // payload.nack();
  }
}
```

### 4. Let HazelJS Discover Consumers

```typescript
import { HazelApp, HazelModule } from '@hazeljs/core';
import { PubSubModule } from '@hazeljs/pubsub';
import { OrderConsumer } from './order.consumer';

@HazelModule({
  imports: [
    PubSubModule.forRoot({
      projectId: process.env.GCP_PROJECT_ID,
    }),
  ],
  providers: [OrderConsumer], // Decorated consumers are discovered from providers
})
class AppModule {}

async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
}

bootstrap();
```

## Acknowledgement Behavior

By default:

- Successful handler execution -> `ack()`
- Handler throws -> `nack()`

You can override this globally via `@PubSubConsumer(...)` or per subscription via `@PubSubSubscribe(...)`.

You can also return `'ack'` or `'nack'` from handler methods for explicit behavior.

## Async Configuration

```typescript
import { ConfigService } from '@hazeljs/config';
import { PubSubModule } from '@hazeljs/pubsub';

PubSubModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    projectId: config.get('GCP_PROJECT_ID'),
    keyFilename: config.get('GOOGLE_APPLICATION_CREDENTIALS'),
  }),
  inject: [ConfigService],
});
```

## Local Emulator

Use the Google Pub/Sub emulator locally:

```bash
export PUBSUB_EMULATOR_HOST=localhost:8085
```

Then configure:

```typescript
PubSubModule.forRoot({
  projectId: 'local-project',
  apiEndpoint: process.env.PUBSUB_EMULATOR_HOST,
});
```

## API Reference

### PubSubPublisherService

- `publish(topicName, data, options?)` - Publish `string | Buffer | object`
- `publishJson(topicName, data, options?)` - Publish JSON with `content-type: application/json`

### Decorators

- `@PubSubConsumer(options?)` - Class-level defaults (`ackOnSuccess`, `nackOnError`, `parseJson`, `autoCreateSubscription`)
- `@PubSubSubscribe(options)` - Method-level subscription handler metadata
  - `subscription` - Subscription name (required)
  - `topic?` - Topic name (required only when `autoCreateSubscription: true`)
  - `autoCreateSubscription?` - Auto-create missing subscription
  - `parseJson?` - Parse message body as JSON
  - `ackOnSuccess?` - Auto-ack successful handler execution
  - `nackOnError?` - Auto-nack on thrown error

### PubSubModule

- `forRoot(options?)` - Sync module config
- `forRootAsync({ useFactory, inject })` - Async module config
- `registerSubscriptionsFromProvider(provider)` - Register decorated handlers from an instantiated provider

## Requirements

- Google Cloud Pub/Sub enabled in your GCP project
- Service account credentials (or emulator)
- Node.js >= 14
