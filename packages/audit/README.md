# @hazeljs/audit

**Audit logging and event trail for HazelJS. Record who did what, when, and with what outcome.**

Compliance-ready audit events from HTTP requests and custom business logic. Console, file, or Kafka. Redact secrets, add actors from context, and plug in your own transports.

[![npm version](https://img.shields.io/npm/v/@hazeljs/audit.svg)](https://www.npmjs.com/package/@hazeljs/audit)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/audit)](https://www.npmjs.com/package/@hazeljs/audit)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **HTTP audit** — `AuditInterceptor` logs every request (method, path, result)
- **Custom events** — Inject `AuditService` and call `log()` with action, resource, actor
- **Transports** — Console (default), file (JSONL with rotation), Kafka (JSON or Avro)
- **@Audit decorator** — Mark handlers with action/resource for metadata and tooling
- **Redaction** — Sensitive keys (password, token, etc.) redacted by default
- **Actor from context** — `actorFromContext()` maps request user to audit actor

## Installation

```bash
npm install @hazeljs/audit @hazeljs/core
```

## Quick Start

### 1. Register the module

```typescript
import { HazelModule } from '@hazeljs/core';
import { AuditModule } from '@hazeljs/audit';

@HazelModule({
  imports: [AuditModule.forRoot()],
})
export class AppModule {}
```

With the module registered, use **AuditInterceptor** to log every HTTP request, or inject **AuditService** and call `log()` for custom events.

### 2. Module options

```typescript
AuditModule.forRoot({
  transports: [new ConsoleAuditTransport()], // default
  includeRequestContext: true,
  redactKeys: ['password', 'token', 'secret', 'authorization'],
});
```

### 3. Custom events with AuditService

```typescript
import { Injectable } from '@hazeljs/core';
import { AuditService } from '@hazeljs/audit';
import type { RequestContext } from '@hazeljs/core';

@Injectable()
export class OrderService {
  constructor(private readonly audit: AuditService) {}

  async create(data: CreateOrderDto, context: RequestContext) {
    const order = await this.repo.create(data);
    this.audit.log({
      action: 'order.create',
      actor: this.audit.actorFromContext(context),
      resource: 'Order',
      resourceId: order.id,
      result: 'success',
      metadata: { amount: order.total },
    });
    return order;
  }
}
```

## Audit event shape

- **action** — e.g. `user.login`, `order.create`
- **actor** — `{ id, username?, role? }` from request context when available
- **resource** / **resourceId** — what was affected
- **result** — `success` | `failure` | `denied`
- **timestamp** — ISO string (set automatically if omitted)
- **method** / **path** — from HTTP context when using the interceptor
- **metadata** — extra structured data (sensitive keys redacted by default)

## Transports

### Console (default)

Writes one JSON line per event to stdout.

```typescript
import { ConsoleAuditTransport } from '@hazeljs/audit';

transports: [new ConsoleAuditTransport()],
```

### File (JSONL)

Appends to a file. Creates the file and parent dir on first event. Supports rotation by size or by day.

```typescript
import { FileAuditTransport } from '@hazeljs/audit';

transports: [
  new FileAuditTransport({
    filePath: 'logs/audit.jsonl',
    ensureDir: true,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    rollDaily: true, // audit.2025-03-01.jsonl
  }),
],
```

### Kafka

Sends each event to a Kafka topic. Use with [@hazeljs/kafka](https://www.npmjs.com/package/@hazeljs/kafka): pass `KafkaProducerService` as the sender. Optional **key** for partitioning; optional **serialize** for custom format (default JSON). For Avro, pass a `serialize` function that returns a `Buffer` (e.g. using `avsc` or Confluent Schema Registry).

```typescript
import { KafkaAuditTransport } from '@hazeljs/audit';
import { KafkaProducerService } from '@hazeljs/kafka';

const transport = new KafkaAuditTransport({
  sender: kafkaProducerService, // from your app's container
  topic: 'audit',
  key: (e) => e.actor?.id?.toString(), // optional partition key
  // serialize: (e) => avroType.toBuffer(e), // optional Avro
});
```

### Custom transport

Implement **AuditTransport** (interface with `log(event: AuditEvent)`) to send events to your database, SIEM, or logging service.

## @Audit decorator

Mark handlers with custom action/resource for metadata and tooling:

```typescript
import { Controller, Post, Body } from '@hazeljs/core';
import { Audit } from '@hazeljs/audit';

@Controller('/orders')
export class OrderController {
  @Post()
  @Audit({ action: 'order.create', resource: 'Order' })
  async create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }
}
```

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/auth)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.com/channels/1448263814238965833/1448263814859456575)
