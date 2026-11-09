# Autonomous runtime quick start

```bash
npm install @hazeljs/autonomous @hazeljs/agent-gatekeeper
hazel add autonomous --setup
```

```ts
@Injectable()
@Autonomous({
  mode: 'governed-auto',
  capabilities: ['orders.retry'],
  objective: 'Maintain reliable order processing',
})
export class OrderOperationsService {
  @Observe('orders.failed')
  onFailure(event: OrderFailedEvent) {
    return event;
  }

  @Capability({
    id: 'orders.retry',
    effect: 'idempotent',
    approval: 'auto',
    idempotencyKey: true,
  })
  retryOrder(input: RetryOrderInput) {
    return this.orders.retry(input);
  }
}
```

Register `AutonomousModule.forRoot()` and emit:

```ts
await runtime.emit('orders.failed', { orderId: 'ORD-1' }, { tenantId: 't1' });
```

See [autonomous-runtime.md](./autonomous-runtime.md) for modes, durability, and CLI.
