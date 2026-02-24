# @hazeljs/prisma

**Prisma ORM Integration for HazelJS**

First-class Prisma support with repository pattern, automatic migrations, and type-safe database access.

[![npm version](https://img.shields.io/npm/v/@hazeljs/prisma.svg)](https://www.npmjs.com/package/@hazeljs/prisma)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/prisma)](https://www.npmjs.com/package/@hazeljs/prisma)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🎯 **Type-Safe Queries** - Full TypeScript support with Prisma
- 🏗️ **Repository Pattern** - Clean data access layer
- 🎨 **Decorator Support** - `@PrismaModel` decorator
- 🔄 **Transaction Support** - Built-in transaction management
- 📊 **Query Builder** - Fluent query interface
- 🔌 **Dependency Injection** - Seamless DI integration
- 🧪 **Testing Utilities** - Mock Prisma for testing
- 📈 **Connection Pooling** - Automatic connection management

## Installation

```bash
npm install @hazeljs/prisma @prisma/client
npm install -D prisma
```

## Quick Start

### 1. Initialize Prisma

```bash
npx prisma init
```

### 2. Define Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 3. Generate Prisma Client

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Configure Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { PrismaModule } from '@hazeljs/prisma';

@HazelModule({
  imports: [
    PrismaModule.forRoot({
      connectionString: process.env.DATABASE_URL,
    }),
  ],
})
export class AppModule {}
```

### 5. Create Repository

```typescript
import { Injectable } from '@hazeljs/core';
import { PrismaService, BaseRepository, PrismaModel } from '@hazeljs/prisma';

@Injectable()
@PrismaModel('User')
export class UserRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // Custom methods
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findWithPosts(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { posts: true },
    });
  }
}
```

### 6. Use in Service

```typescript
import { Injectable } from '@hazeljs/core';

@Injectable()
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async create(data: { email: string; name: string }) {
    return this.userRepository.create({ data });
  }

  async findAll() {
    return this.userRepository.findMany();
  }

  async findOne(id: string) {
    return this.userRepository.findUnique({ where: { id } });
  }

  async update(id: string, data: any) {
    return this.userRepository.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.userRepository.delete({ where: { id } });
  }
}
```

## Base Repository

The `BaseRepository` provides common CRUD operations:

```typescript
class BaseRepository {
  // Create
  create(args: Prisma.UserCreateArgs): Promise<User>;
  createMany(args: Prisma.UserCreateManyArgs): Promise<Prisma.BatchPayload>;

  // Read
  findUnique(args: Prisma.UserFindUniqueArgs): Promise<User | null>;
  findFirst(args: Prisma.UserFindFirstArgs): Promise<User | null>;
  findMany(args?: Prisma.UserFindManyArgs): Promise<User[]>;
  count(args?: Prisma.UserCountArgs): Promise<number>;

  // Update
  update(args: Prisma.UserUpdateArgs): Promise<User>;
  updateMany(args: Prisma.UserUpdateManyArgs): Promise<Prisma.BatchPayload>;
  upsert(args: Prisma.UserUpsertArgs): Promise<User>;

  // Delete
  delete(args: Prisma.UserDeleteArgs): Promise<User>;
  deleteMany(args?: Prisma.UserDeleteManyArgs): Promise<Prisma.BatchPayload>;
}
```

## Transactions

### Using PrismaService

```typescript
@Injectable()
export class TransferService {
  constructor(private prisma: PrismaService) {}

  async transfer(fromId: string, toId: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      // Deduct from sender
      await tx.account.update({
        where: { id: fromId },
        data: { balance: { decrement: amount } },
      });

      // Add to receiver
      await tx.account.update({
        where: { id: toId },
        data: { balance: { increment: amount } },
      });

      // Create transaction record
      return tx.transaction.create({
        data: { fromId, toId, amount },
      });
    });
  }
}
```

### Using Repository

```typescript
@Injectable()
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private inventoryRepository: InventoryRepository,
    private prisma: PrismaService
  ) {}

  async createOrder(userId: string, items: OrderItem[]) {
    return this.prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          userId,
          items: { create: items },
        },
      });

      // Update inventory
      for (const item of items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      return order;
    });
  }
}
```

## Advanced Queries

### Relations

```typescript
@Injectable()
export class UserRepository extends BaseRepository {
  async findWithRelations(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        posts: {
          where: { published: true },
          orderBy: { createdAt: 'desc' },
        },
        profile: true,
      },
    });
  }
}
```

### Pagination

```typescript
@Injectable()
export class PostRepository extends BaseRepository {
  async findPaginated(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count(),
    ]);

    return {
      data: posts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

### Filtering

```typescript
@Injectable()
export class ProductRepository extends BaseRepository {
  async search(query: string, filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }) {
    return this.prisma.product.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          filters.category ? { category: filters.category } : {},
          filters.minPrice ? { price: { gte: filters.minPrice } } : {},
          filters.maxPrice ? { price: { lte: filters.maxPrice } } : {},
          filters.inStock ? { stock: { gt: 0 } } : {},
        ],
      },
    });
  }
}
```

### Aggregations

```typescript
@Injectable()
export class AnalyticsRepository {
  constructor(private prisma: PrismaService) {}

  async getOrderStats() {
    return this.prisma.order.aggregate({
      _sum: { total: true },
      _avg: { total: true },
      _count: true,
      _max: { total: true },
      _min: { total: true },
    });
  }

  async getRevenueByMonth() {
    return this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        SUM(total) as revenue,
        COUNT(*) as orders
      FROM "Order"
      GROUP BY month
      ORDER BY month DESC
    `;
  }
}
```

## Middleware

Add Prisma middleware for logging, soft deletes, etc:

```typescript
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super();

    // Logging middleware
    this.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      
      console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
      return result;
    });

    // Soft delete middleware
    this.$use(async (params, next) => {
      if (params.action === 'delete') {
        params.action = 'update';
        params.args['data'] = { deletedAt: new Date() };
      }
      
      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (params.args.data != undefined) {
          params.args.data['deletedAt'] = new Date();
        } else {
          params.args['data'] = { deletedAt: new Date() };
        }
      }
      
      return next(params);
    });
  }
}
```

## Seeding

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create users
  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      posts: {
        create: [
          {
            title: 'First Post',
            content: 'Hello World!',
            published: true,
          },
        ],
      },
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob',
    },
  });

  console.log({ alice, bob });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Run seed:

```bash
npx prisma db seed
```

## Testing

### Mock Prisma Service

```typescript
import { TestingModule } from '@hazeljs/core';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';

describe('UserService', () => {
  let service: UserService;
  let repository: UserRepository;

  const mockPrisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await TestingModule.create({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: {
            create: mockPrisma.user.create,
            findMany: mockPrisma.user.findMany,
            findUnique: mockPrisma.user.findUnique,
            update: mockPrisma.user.update,
            delete: mockPrisma.user.delete,
          },
        },
      ],
    });

    service = module.get(UserService);
    repository = module.get(UserRepository);
  });

  it('should create a user', async () => {
    const userData = { email: 'test@example.com', name: 'Test' };
    mockPrisma.user.create.mockResolvedValue({ id: '1', ...userData });

    const result = await service.create(userData);
    
    expect(result).toEqual({ id: '1', ...userData });
    expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: userData });
  });
});
```

## Best Practices

1. **Use Repositories** - Encapsulate data access logic
2. **Type Safety** - Leverage Prisma's generated types
3. **Transactions** - Use transactions for related operations
4. **Indexes** - Add indexes for frequently queried fields
5. **Migrations** - Always use migrations, never modify schema directly
6. **Connection Pooling** - Configure appropriate pool size
7. **Error Handling** - Handle Prisma errors gracefully
8. **Soft Deletes** - Implement soft deletes with middleware

## Migration Commands

```bash
# Create migration
npx prisma migrate dev --name add_user_role

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Generate client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

## Examples

See the [examples](../../example/src/prisma) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/prisma)
- [Prisma Docs](https://www.prisma.io/docs)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
