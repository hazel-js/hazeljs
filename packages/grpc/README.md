# @hazeljs/grpc

**gRPC Module for HazelJS**

RPC server support with decorator-based handlers. Built on [@grpc/grpc-js](https://www.npmjs.com/package/@grpc/grpc-js) and [@grpc/proto-loader](https://www.npmjs.com/package/@grpc/proto-loader).

[![npm version](https://img.shields.io/npm/v/@hazeljs/grpc.svg)](https://www.npmjs.com/package/@hazeljs/grpc)
[![License: Apache-2.0](https://img.shields.io/npm/l/@hazeljs/grpc.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Decorator-Based API** - `@GrpcMethod()` for declarative RPC handlers
- **DI Integration** - Controllers are resolved from the HazelJS container
- **Proto Loading** - Load `.proto` files at runtime with configurable options
- **Unary RPC** - Support for request-response RPC methods

## Installation

```bash
npm install @hazeljs/grpc
```

## Quick Start

### 1. Define your service in a .proto file

```proto
syntax = "proto3";
package hero;

service HeroService {
  rpc FindOne (HeroById) returns (Hero);
}

message HeroById {
  int32 id = 1;
}

message Hero {
  int32 id = 1;
  string name = 2;
}
```

### 2. Import GrpcModule and create a controller

```typescript
import { Injectable } from '@hazeljs/core';
import { GrpcMethod } from '@hazeljs/grpc';
import { join } from 'path';
import { HazelModule } from '@hazeljs/core';
import { GrpcModule } from '@hazeljs/grpc';

@Injectable()
export class HeroGrpcController {
  @GrpcMethod('HeroService', 'FindOne')
  findOne(data: { id: number }) {
    return { id: data.id, name: 'Hero' };
  }
}

@HazelModule({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, 'hero.proto'),
      package: 'hero',
      url: '0.0.0.0:50051',
    }),
  ],
  providers: [HeroGrpcController],
})
export class AppModule {}
```

### 3. Register handlers and start the gRPC server

```typescript
import { HazelApp } from '@hazeljs/core';
import { GrpcModule, GrpcServer } from '@hazeljs/grpc';
import { Container } from '@hazeljs/core';
import { AppModule } from './app.module';
import { HeroGrpcController } from './hero.grpc-controller';

async function bootstrap() {
  const app = new HazelApp(AppModule);

  // Register gRPC handlers from controllers
  GrpcModule.registerHandlersFromProviders([HeroGrpcController]);

  // Start HTTP server
  await app.listen(3000);

  // Start gRPC server (runs on separate port)
  const grpcServer = Container.getInstance().resolve(GrpcServer);
  await grpcServer.start();
}

bootstrap();
```

## Configuration

```typescript
GrpcModule.forRoot({
  protoPath: join(__dirname, 'hero.proto'),  // or ['a.proto', 'b.proto']
  package: 'hero',                             // package name from .proto
  url: '0.0.0.0:50051',                       // bind address (default: 0.0.0.0:50051)
  loader: {                                    // @grpc/proto-loader options
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  },
  isGlobal: true,                              // global module (default)
});
```

## Async Configuration

```typescript
GrpcModule.forRootAsync({
  useFactory: async (config: ConfigService) => ({
    protoPath: config.get('GRPC_PROTO_PATH'),
    package: config.get('GRPC_PACKAGE'),
    url: config.get('GRPC_URL'),
  }),
  inject: [ConfigService],
});
```

## @GrpcMethod Decorator

```typescript
// Explicit service and method name
@GrpcMethod('HeroService', 'FindOne')
findOne(data: { id: number }) {
  return { id: data.id, name: 'Hero' };
}

// Method name defaults to the decorated method name
@GrpcMethod('HeroService')
findOne(data: { id: number }) {
  return { id: data.id, name: 'Hero' };
}

// Async handlers are supported
@GrpcMethod('HeroService', 'FindOne')
async findOne(data: { id: number }) {
  const hero = await this.heroRepository.findById(data.id);
  return hero;
}
```

## API

- **GrpcModule** - Module with `forRoot(options)`, `forRootAsync(options)`, `registerHandlersFromProvider(provider)`, `registerHandlersFromProviders(providerClasses)`
- **GrpcServer** - Injectable service with `configure(options)`, `start()`, `close()`, `registerHandlersFromProvider(provider)`, `registerHandlersFromProviders(providerClasses)`
- **GrpcMethod(serviceName, methodName?)** - Decorator for RPC method handlers
- **getGrpcMethodMetadata(target)** - Get @GrpcMethod metadata from a class
