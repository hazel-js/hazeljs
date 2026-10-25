# @hazeljs/redis

**Shared Redis client and pub/sub for HazelJS.**

One connection for commands, a dedicated subscriber for fan-out. Decorator-based channel handlers (like `@OnMessage` / `@OnEvent`) plus a low-level `RedisPubSub` API when you need it.

[![npm version](https://img.shields.io/npm/v/@hazeljs/redis.svg)](https://www.npmjs.com/package/@hazeljs/redis)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **RedisModule.forRoot** — URL, host/port, or inject an existing client
- **RedisService** — shared command client (`getClient`, `ping`, `duplicate`)
- **RedisPubSub** — dedicated subscribe connection; `publish` / `subscribe` / `unsubscribe`
- **@OnChannel** — decorator subscribers (JSON-parsed by default)
- **JSON publish** — objects are stringified automatically

## Installation

```bash
npm install @hazeljs/redis ioredis
```

## Quick Start

```typescript
import { HazelModule } from '@hazeljs/core';
import { RedisModule } from '@hazeljs/redis';

@HazelModule({
  imports: [
    RedisModule.forRoot({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  providers: [SpaceEventsHandler],
})
export class AppModule {}
```

### Pub/sub with `@OnChannel` (recommended)

```typescript
import { Inject, Service } from '@hazeljs/core';
import { OnChannel, RedisPubSub } from '@hazeljs/redis';

@Service()
export class SpaceEventsHandler {
  constructor(@Inject(RedisPubSub) private readonly pubsub: RedisPubSub) {}

  @OnChannel('app:space-events')
  onSpaceEvent(payload: { spaceId: string; eventType: string }) {
    // runs on every API instance that registered this handler
  }

  async publish(payload: object): Promise<void> {
    await this.pubsub.publish('app:space-events', payload);
  }
}
```

Register after bootstrap (same pattern as `@OnEvent` / Cron):

```typescript
import { RedisModule } from '@hazeljs/redis';

await RedisModule.registerSubscribersFromProviders([SpaceEventsHandler]);
```

Pass `{ parseJson: false }` to receive the raw Redis string.

### Health check

```typescript
const redis = app.getContainer().resolve(RedisService);
app.registerHealthCheck({
  name: 'redis',
  critical: true,
  timeout: 2000,
  check: async () => {
    await redis.ping();
    return { status: 'healthy' as const };
  },
});
```

## API

| Export                                                  | Role                                    |
| ------------------------------------------------------- | --------------------------------------- |
| `RedisModule.forRoot(options)`                          | Register `RedisService` + `RedisPubSub` |
| `RedisModule.registerSubscribersFromProvider(instance)` | Wire `@OnChannel` handlers              |
| `RedisModule.registerSubscribersFromProviders(classes)` | Resolve + wire providers                |
| `@OnChannel(channel, options?)`                         | Subscribe method decorator              |
| `RedisService`                                          | Command client                          |
| `RedisPubSub`                                           | Imperative publish / subscribe          |

Options: `url`, `connection` (`host`/`port`/`password`/…), or `client` (existing ioredis).

## Notes

- A Redis connection in subscribe mode cannot run other commands — `@hazeljs/redis` keeps a separate subscriber via `duplicate()`.
- For background **jobs**, use `@hazeljs/queue` (BullMQ). Pub/sub is for **broadcast**, not competing consumers.
- **Publish** stays imperative (`RedisPubSub.publish`) — only subscribe benefits from decorators.
