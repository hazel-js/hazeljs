# Saga Patterns: Distributed Transactions

HazelJS provides a robust Saga pattern implementation via the `@hazeljs/saga` package. This allows you to manage distributed transactions across multiple services with a clear, automated compensation logic (rollback).

## 📦 Installation

```bash
npm install @hazeljs/saga
```

## 🚀 Quick Start

### 1. Register the Saga Module

Register the `SagaModule` and `EventEmitterModule` (required for choreography) in your application.

```typescript
import { HazelModule, EventEmitterModule } from '@hazeljs/core';
import { SagaModule } from '@hazeljs/saga';

@HazelModule({
  imports: [
    EventEmitterModule,
    SagaModule.forRoot({
      backend: 'memory', // or 'redis' for persistence
    }),
  ],
})
export class AppModule {}
```

### 2. Using the Orchestration Saga

Orchestration is the most common Saga pattern where a central component (the Orchestrator) manages each step and coordinates rollbacks.

```typescript
import { Controller, Post, Body } from '@hazeljs/core';
import { SagaOrchestrator, Step } from '@hazeljs/saga';

@Controller('/orders')
export class OrderController {
  constructor(private orchestrator: SagaOrchestrator) {}

  @Post('/create')
  async createOrder(@Body() { productId, quantity }: { productId: string, quantity: number }) {
    // Define a multi-step Saga
    const saga = this.orchestrator.create('create-order')
      .step('inventory', {
        execute: async (ctx) => await this.inventoryService.reserve(productId, quantity),
        compensate: async (ctx) => await this.inventoryService.cancelReservation(productId, quantity),
      })
      .step('payment', {
        execute: async (ctx) => await this.paymentService.charge(quantity * 100),
        compensate: async (ctx) => await this.paymentService.refund(quantity * 100),
      })
      .step('shipping', {
        execute: async (ctx) => await this.shippingService.ship(productId),
      });

    // Execute the transaction
    const result = await saga.execute({ productId, quantity });
    
    if (result.status === 'failed') {
      // All previous steps are automatically rolled back (compensated)
      throw new Error('Order creation failed');
    }
    
    return result;
  }
}
```

### 3. Using the Choreography Saga

Choreography uses a decentralized approach where each step emits events that trigger the next step.

```typescript
import { Injectable } from '@hazeljs/core';
import { SagaChoreography, SagaEvent } from '@hazeljs/saga';

@Injectable()
export class InventoryService {
  @SagaChoreography('order:created')
  async reserveInventory(@SagaEvent() event: OrderCreatedEvent) {
    // Run business logic
    const reserved = await this.reserve(event.productId, event.quantity);
    
    if (!reserved) {
      // Trigger rollback by emitting a failure event
      return { status: 'failed', event: 'inventory:reserve:failed' };
    }
    
    // Trigger next step by emitting success event
    return { status: 'success', event: 'inventory:reserved' };
  }

  @SagaChoreography('inventory:reserve:failed', { type: 'compensate' })
  async releaseInventory(@SagaEvent() event: OrderCreatedEvent) {
    // Compensation logic (rollback)
    await this.release(event.productId, event.quantity);
  }
}
```

## 🧠 Core Concepts

| Concept | Description |
|---------|-------------|
| **Saga** | A sequence of local transactions. |
| **Step** | A single operation in the Saga. |
| **Execute** | The forward logic (the forward operation). |
| **Compensate** | The reverse logic (the rollback operation). |
| **Orchestrator** | A central coordinator for the Saga. |
| **Choreographer** | Event-driven decentralized coordination. |

## 🛡️ Reliability Features

- **Automatic Rollback**: If any step in an Orchestration Saga fails, HazelJS automatically triggers the `compensate` methods of all *previously completed* steps in reverse order.
- **Saga Persistence**: With the 'redis' backend, Sagas are stored durably, allowing recovery from crashes.
- **Human-in-the-Loop**: You can pause a Saga and wait for manual approval.
- **Timeout Support**: Automatically fail and compensate Sagas that take too long.

## 🔑 Best Practices

1. **Keep steps idempotent**: Compensation logic may be triggered multiple times; ensure it's safe to run again.
2. **Handle partial failures**: Not everything can be rolled back (e.g., sending an email). Use these steps carefully and preferably as the last step.
3. **Use granular steps**: Smaller steps make for more reliable rollbacks.
4. **Context usage**: Use the Saga context to share data between steps (e.g., passing a temporary ID generated in step 1 to step 2).
