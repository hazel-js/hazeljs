# @hazeljs/event-emitter

**Event Emitter Module for HazelJS**

Event-driven architecture with decorators, similar to `@nestjs/event-emitter`. Built on [eventemitter2](https://github.com/EventEmitter2/EventEmitter2) with support for wildcards, namespaces, and async listeners.

[![npm version](https://img.shields.io/npm/v/@hazeljs/event-emitter.svg)](https://www.npmjs.com/package/@hazeljs/event-emitter)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Decorator-Based API** - `@OnEvent()` for declarative event listeners
- **DI Integration** - Inject `EventEmitterService` anywhere in your app
- **Wildcards** - Listen to event patterns (e.g. `order.*`) when enabled
- **Async Listeners** - Support for async event handlers
- **Error Handling** - Configurable error suppression for listeners

## Installation

```bash
npm install @hazeljs/event-emitter
```

## Quick Start

### 1. Import EventEmitterModule

```typescript
import { HazelModule } from '@hazeljs/core';
import { EventEmitterModule } from '@hazeljs/event-emitter';

@HazelModule({
  imports: [EventEmitterModule.forRoot()],
  providers: [OrderService, OrderEventHandler],
})
export class AppModule {}
```

### 2. Emit Events

```typescript
import { Injectable } from '@hazeljs/core';
import { EventEmitterService } from '@hazeljs/event-emitter';

@Injectable()
export class OrderService {
  constructor(private eventEmitter: EventEmitterService) {}

  createOrder(order: Order) {
    // ... create order
    this.eventEmitter.emit('order.created', { orderId: order.id, order });
  }
}
```

### 3. Listen to Events

```typescript
import { Injectable } from '@hazeljs/core';
import { OnEvent, EventEmitterModule } from '@hazeljs/event-emitter';

@Injectable()
export class OrderEventHandler {
  @OnEvent('order.created')
  handleOrderCreated(payload: { orderId: string; order: Order }) {
    console.log('Order created:', payload.orderId);
  }
}
```

### 4. Register Listeners

After your app initializes, register listeners from providers that have `@OnEvent` decorators:

```typescript
import { EventEmitterModule } from '@hazeljs/event-emitter';

// Register from provider classes (resolves from DI container)
EventEmitterModule.registerListenersFromProviders([OrderEventHandler]);

// Or register from a specific instance
const orderHandler = container.resolve(OrderEventHandler);
EventEmitterModule.registerListenersFromProvider(orderHandler);
```

## Configuration

```typescript
EventEmitterModule.forRoot({
  wildcard: true,        // Enable 'order.*' style patterns
  delimiter: '.',       // Namespace delimiter
  maxListeners: 10,     // Max listeners per event
  isGlobal: true,       // Global module (default)
});
```

## @OnEvent Options

```typescript
@OnEvent('order.created', { async: true })
async handleOrderCreated(payload: OrderCreatedEvent) {
  await sendEmail(payload);
}

@OnEvent('order.*', { suppressErrors: false })
handleOrderEvents(payload: unknown) {
  // Errors will be rethrown
}
```

## API

- **EventEmitterModule** - Module with `forRoot(options?)` and `registerListenersFromProvider(provider)`
- **EventEmitterService** - Injectable service extending EventEmitter2 (`emit`, `emitAsync`, `on`, etc.)
- **OnEvent(event, options?)** - Decorator for event listeners
- **getOnEventMetadata(target)** - Get @OnEvent metadata from a class
