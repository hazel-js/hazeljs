# @hazeljs/saga

**Distributed Transaction Management for HazelJS. Orchestration, Choreography, and Auto-Compensation.**

Manage complex, multi-service transactions with ease. Whether you prefer centralized control (Orchestration) or decentralized event-driven flows (Choreography), HazelJS Saga provides a robust, decorator-based framework to ensure data consistency across your distributed system.

[![npm version](https://img.shields.io/npm/v/@hazeljs/saga.svg)](https://www.npmjs.com/package/@hazeljs/saga)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/saga)](https://www.npmjs.com/package/@hazeljs/saga)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🔄 **Dual Models** — Orchestration for centralized control and Choreography for decentralized, event-driven coordination.
- 🛠️ **Decorator-Based API** — Declarative Saga definition using `@Saga`, `@SagaStep`, and `@OnEvent`.
- ⏪ **Auto-Compensation** — Automatically reverses completed steps in reverse order when a failure occurs.
- 📊 **Status Management** — Built-in tracking for `STARTED`, `COMPENSATING`, `ABORTED`, and `COMPLETED` states.
- 🧠 **Context Awareness** — Type-safe `SagaContext` to pass state and data across multiple transaction steps.
- 🔌 **HazelJS Integration** — Seamlessly works with `@hazeljs/event-emitter` and `@hazeljs/core`.

---

## Installation

```bash
npm install @hazeljs/saga
```

### Peer Dependencies

Ensure you have these installed as they are required for decorators and event-driven sagas:

```bash
npm install reflect-metadata
npm install @hazeljs/event-emitter
```

---

## Quick Start (Orchestration)

The Orchestration model uses a central class to coordinate the workflow. If a step fails, compensation methods are automatically triggered.

### 1. Define the Saga

```typescript
import { Saga, SagaStep } from '@hazeljs/saga';

@Saga({ name: 'order-saga' })
export class OrderSaga {
  
  @SagaStep({ order: 1, compensate: 'cancelOrder' })
  async createOrder(data: any) {
    console.log('Order created for:', data.productId);
    return { orderId: 'ord_123' };
  }

  @SagaStep({ order: 2, compensate: 'releaseInventory' })
  async reserveInventory(data: any) {
    // Logic to reserve stock...
    return { status: 'RESERVED' };
  }

  async cancelOrder(data: any) {
    console.log('Reversing order...');
  }

  async releaseInventory(data: any) {
    console.log('Releasing stock...');
  }
}
```

### 2. Execute the Saga

```typescript
import { SagaOrchestrator } from '@hazeljs/saga';

const orchestrator = SagaOrchestrator.getInstance();
const context = await orchestrator.start('order-saga', { productId: 'p1', userId: 'u1' });

console.log(`Saga Status: ${context.status}`); // COMPLETED or ABORTED
```

---

## Orchestration vs. Choreography

| Feature | Orchestration | Choreography |
|---|---|---|
| **Control** | Centralized in one class | Decentralized across handlers |
| **Coupling** | High (Orchestrator knows all steps) | Low (Each service reacts to events) |
| **Complexity** | Simple for small/medium flows | Better for very large, loosely coupled systems |
| **Visibility** | Single point of truth | Distributed across the system |

---

## Saga Choreography

Choreography is entirely event-driven. Handlers subscribe to events and emit new ones to trigger the next phase of the transaction.

```typescript
import { SagaChoreography, OnEvent } from '@hazeljs/saga';

@SagaChoreography()
export class ShippingChoreography {
  
  @OnEvent('inventory.reserved')
  async handleInventoryReserved(order: any) {
    console.log('Shipping label generated for:', order.id);
    // Emit 'shipping.labeled' to continue the flow
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(order: any) {
    console.log('Cancelling shipping for:', order.id);
    // Manual compensation for choreography
  }
}
```

---

## Saga Lifecycle & Statuses

The `SagaContext` tracks the status of the transaction as it progresses:

| Status | Description |
|--------|-------------|
| `STARTED` | Execution has begun. |
| `COMPLETED` | All steps finished successfully. |
| `FAILED` | A step encountered an error; compensation is pending. |
| `COMPENSATING` | Reversing previously completed steps. |
| `ABORTED` | Compensation finished; the transaction is rolled back. |

---

## API Reference

### `SagaOrchestrator`

```typescript
class SagaOrchestrator {
  static getInstance(): SagaOrchestrator;
  registerSaga(name: string, target: any): void;
  registerStep(sagaName: string, methodName: string, options: SagaStepOptions): void;
  start<T>(sagaName: string, initialData: T): Promise<SagaContext<T>>;
}
```

### `Decorators`

- **`@Saga(options)`** — Marks a class as a centralized Saga Orchestrator.
- **`@SagaStep(options)`** — Marks a method as a step. Options include `order` and `compensate` (method name).
- **`@SagaChoreography()`** — Marks a class as a collection of event-driven saga handlers.
- **`@OnEvent(eventName)`** — Subscribes a method to a specific event within a choreography.

---

## Use Cases

- 🛒 **E-commerce Checkout** — Coordinating orders, payments, and inventory.
- 🏨 **Hotel/Flight Bookings** — Managing multi-vendor reservation systems.
- 💳 **Financial Transfers** — Ensuring atomic-like consistency across different account services.
- 🏗️ **Infrastructure Provisioning** — rolling back cloud resource creation on failure.

---

## License

Apache-2.0

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
