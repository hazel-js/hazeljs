# @hazeljs/graphql

GraphQL server and client for HazelJS with decorator-based schema and typed client.

[![npm version](https://img.shields.io/npm/v/@hazeljs/graphql.svg)](https://www.npmjs.com/package/@hazeljs/graphql)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/graphql)](https://www.npmjs.com/package/@hazeljs/graphql)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Installation

```bash
npm install @hazeljs/graphql @hazeljs/core
```

## Server Usage

### 1. Define Object Types (optional, for complex return types)

```typescript
import { ObjectType, Field } from '@hazeljs/graphql';

@ObjectType()
class User {
  @Field()
  id: string;

  @Field()
  name: string;
}
```

### 2. Create Resolvers

```typescript
import { Injectable } from '@hazeljs/core';
import { Resolver, Query, Mutation, Arg } from '@hazeljs/graphql';

@Injectable()
@Resolver()
export class UserResolver {
  @Query()
  hello() {
    return 'Hello, GraphQL!';
  }

  @Query()
  user(@Arg('id') id: string) {
    return { id, name: 'John Doe' };
  }

  @Mutation()
  createUser(@Arg('name') name: string) {
    return { id: '1', name };
  }
}
```

### 3. Register GraphQL Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { GraphQLModule } from '@hazeljs/graphql';
import { UserResolver } from './user.resolver';

@HazelModule({
  imports: [
    GraphQLModule.forRoot({
      path: '/graphql',
      resolvers: [UserResolver],
    }),
  ],
})
export class AppModule {}
```

### 4. Start the App

```typescript
import { HazelApp } from '@hazeljs/core';

const app = new HazelApp(AppModule);
app.listen(3000);
// GraphQL available at http://localhost:3000/graphql
```

## Client Usage

```typescript
import { GraphQLClient } from '@hazeljs/graphql';

const client = new GraphQLClient({
  url: 'http://localhost:3000/graphql',
});

// Query
const data = await client.query(`
  query {
    hello
    user(id: "1") { id name }
  }
`);

// Mutation
const result = await client.mutate(`
  mutation {
    createUser(name: "Alice") { id name }
  }
`);
```

## Decorators Reference

### Server
- `@ObjectType(name?)` - Mark class as GraphQL object type
- `@Field(name?)` - Mark property/method as field
- `@Resolver(name?)` - Mark class as resolver
- `@Query(name?)` - Mark method as Query field
- `@Mutation(name?)` - Mark method as Mutation field
- `@Arg(name, type?)` - Mark parameter as GraphQL argument

### Client
- `@GraphQLClientClass(url, headers?)` - Mark class as GraphQL client
- `@GraphQLQuery()` - Mark method as query executor
- `@GraphQLMutation()` - Mark method as mutation executor
