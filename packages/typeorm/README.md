# @hazeljs/typeorm

**TypeORM + HazelJS. Repository pattern, DI, lifecycle.**

DataSource as an injectable service, `BaseRepository` and `@Repository` / `@InjectRepository` decorators. Full CRUD and transactions via TypeORM.

[![npm version](https://img.shields.io/npm/v/@hazeljs/typeorm.svg)](https://www.npmjs.com/package/@hazeljs/typeorm)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/typeorm)](https://www.npmjs.com/package/@hazeljs/typeorm)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **DataSource integration** – TypeORM DataSource as injectable `TypeOrmService`
- **Repository pattern** – `BaseRepository<T>` with find / findOne / create / save / update / delete / count
- **Decorators** – `@Repository({ model: 'User' })` and `@InjectRepository()` for DI
- **Lifecycle** – connect in `onModuleInit`, disconnect in `onModuleDestroy`
- **forRoot** – optional `TypeOrmModule.forRoot(options)` for custom DataSource options

## Installation

```bash
npm install @hazeljs/typeorm typeorm
```

## Quick Start

### 1. Set DATABASE_URL

```bash
# .env
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
```

### 2. Register the module

```typescript
import { HazelModule } from '@hazeljs/core';
import { TypeOrmModule } from '@hazeljs/typeorm';

@HazelModule({
  imports: [TypeOrmModule],
})
export class AppModule {}
```

With custom options:

```typescript
import { TypeOrmModule } from '@hazeljs/typeorm';

@HazelModule({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      password: 'pass',
      database: 'mydb',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
    }),
  ],
})
export class AppModule {}
```

### 3. Define an entity

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;
}
```

### 4. Create a repository

`@Repository` implies `@Injectable()` — no need to add both decorators.

```typescript
import { BaseRepository, Repository, TypeOrmService } from '@hazeljs/typeorm';
import { UserEntity } from './user.entity';

@Repository({ model: 'User' })
export class UserRepository extends BaseRepository<UserEntity> {
  constructor(typeOrm: TypeOrmService) {
    super(typeOrm, UserEntity);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.findOne({ where: { email } });
  }
}
```

### 5. Use in a service

Use `@Service` for service classes — it is the correct decorator for business-logic classes in HazelJS (not `@Injectable`).

```typescript
import { Service } from '@hazeljs/core';
import { InjectRepository } from '@hazeljs/typeorm';
import { UserRepository } from './user.repository';

@Service()
export class UserService {
  constructor(
    @InjectRepository()
    private readonly userRepository: UserRepository
  ) {}

  async findAll() {
    return this.userRepository.find();
  }

  async create(data: { email: string; name: string }) {
    return this.userRepository.create(data);
  }
}
```

## Transactions

Use `TypeOrmService.dataSource` for transactions:

```typescript
import { Service } from '@hazeljs/core';
import { TypeOrmService } from '@hazeljs/typeorm';

@Service()
export class TransferService {
  constructor(private readonly typeOrm: TypeOrmService) {}

  async transfer(fromId: string, toId: string, amount: number) {
    await this.typeOrm.dataSource.transaction(async (manager) => {
      await manager.decrement(Account, { id: fromId }, 'balance', amount);
      await manager.increment(Account, { id: toId }, 'balance', amount);
    });
  }
}
```

## Links

- [TypeORM docs](https://typeorm.io)
- [HazelJS](https://hazeljs.com)
- [GitHub](https://github.com/hazel-js/hazeljs)

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)
