# @hazeljs/config

**Configuration Module for HazelJS - Environment Variables and Type-Safe Configuration**

Manage application configuration with environment variables, validation, and type safety.

[![npm version](https://img.shields.io/npm/v/@hazeljs/config.svg)](https://www.npmjs.com/package/@hazeljs/config)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🔐 **Environment Variables** - Load from .env files
- ✅ **Validation** - Validate configuration on startup
- 🎯 **Type Safety** - Full TypeScript support
- 🏗️ **Schema-Based** - Define configuration schema
- 🔄 **Hot Reload** - Reload configuration without restart (optional)
- 📁 **Multiple Environments** - Support for .env.development, .env.production, etc.
- 🎨 **Decorator Support** - Inject configuration with decorators
- 🔒 **Secret Management** - Secure handling of sensitive data

## Installation

```bash
npm install @hazeljs/config
```

## Quick Start

### 1. Create Configuration Schema

```typescript
import { IsString, IsNumber, IsEnum } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class AppConfig {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  REDIS_URL: string;
}
```

### 2. Configure Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { ConfigModule } from '@hazeljs/config';
import { AppConfig } from './app.config';

@HazelModule({
  imports: [
    ConfigModule.forRoot({
      schema: AppConfig,
      envFilePath: '.env',
      validate: true,
    }),
  ],
})
export class AppModule {}
```

### 3. Use Configuration

```typescript
import { Injectable } from '@hazeljs/core';
import { ConfigService } from '@hazeljs/config';

@Injectable()
export class DatabaseService {
  constructor(private configService: ConfigService<AppConfig>) {}

  connect() {
    const dbUrl = this.configService.get('DATABASE_URL');
    const port = this.configService.get('PORT');
    
    console.log(`Connecting to database: ${dbUrl}`);
    console.log(`Server will run on port: ${port}`);
  }
}
```

## Environment Files

### Multiple Environment Files

```typescript
ConfigModule.forRoot({
  schema: AppConfig,
  envFilePath: [
    '.env',
    `.env.${process.env.NODE_ENV}`,
    '.env.local',
  ],
  validate: true,
})
```

### File Priority

Files are loaded in order, with later files overriding earlier ones:
1. `.env` - Base configuration
2. `.env.${NODE_ENV}` - Environment-specific
3. `.env.local` - Local overrides (gitignored)

### Example .env File

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-super-secret-key
REDIS_URL=redis://localhost:6379

# API Keys
OPENAI_API_KEY=sk-...
STRIPE_API_KEY=sk_test_...

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_CACHING=true
```

## Configuration Validation

### Basic Validation

```typescript
import { IsString, IsNumber, IsUrl, IsBoolean } from 'class-validator';

export class AppConfig {
  @IsString()
  NODE_ENV: string;

  @IsNumber()
  PORT: number;

  @IsUrl()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsBoolean()
  ENABLE_CACHING: boolean;
}
```

### Custom Validation

```typescript
import { IsString, ValidateIf, MinLength } from 'class-validator';

export class AppConfig {
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  @ValidateIf(o => o.NODE_ENV === 'production')
  @IsString()
  SSL_CERT_PATH: string;
}
```

### Transform Values

```typescript
import { Transform } from 'class-transformer';

export class AppConfig {
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT: number;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  ENABLE_CACHING: boolean;

  @Transform(({ value }) => value.split(','))
  ALLOWED_ORIGINS: string[];
}
```

## Nested Configuration

```typescript
export class DatabaseConfig {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsString()
  database: string;
}

export class AppConfig {
  @IsString()
  NODE_ENV: string;

  @ValidateNested()
  @Type(() => DatabaseConfig)
  database: DatabaseConfig;
}
```

## Dependency Injection

### Inject ConfigService

```typescript
import { Injectable } from '@hazeljs/core';
import { ConfigService } from '@hazeljs/config';

@Injectable()
export class MyService {
  constructor(private config: ConfigService<AppConfig>) {}

  doSomething() {
    const apiKey = this.config.get('OPENAI_API_KEY');
    const port = this.config.get('PORT');
  }
}
```

### Inject Specific Config Values

```typescript
import { InjectConfig } from '@hazeljs/config';

@Injectable()
export class MyService {
  constructor(
    @InjectConfig('DATABASE_URL') private dbUrl: string,
    @InjectConfig('PORT') private port: number
  ) {}

  connect() {
    console.log(`Connecting to ${this.dbUrl} on port ${this.port}`);
  }
}
```

## Configuration Namespaces

Organize configuration into logical groups:

```typescript
export class DatabaseConfig {
  @IsString()
  url: string;

  @IsNumber()
  poolSize: number;
}

export class RedisConfig {
  @IsString()
  url: string;

  @IsNumber()
  ttl: number;
}

export class AppConfig {
  @ValidateNested()
  @Type(() => DatabaseConfig)
  database: DatabaseConfig;

  @ValidateNested()
  @Type(() => RedisConfig)
  redis: RedisConfig;
}

// Usage
const dbConfig = this.config.get('database');
console.log(dbConfig.url);
console.log(dbConfig.poolSize);
```

## Default Values

```typescript
export class AppConfig {
  @IsNumber()
  @Default(3000)
  PORT: number;

  @IsBoolean()
  @Default(false)
  ENABLE_DEBUG: boolean;

  @IsString()
  @Default('info')
  LOG_LEVEL: string;
}
```

## Dynamic Configuration

Load configuration from external sources:

```typescript
ConfigModule.forRoot({
  schema: AppConfig,
  load: [
    async () => {
      // Load from database
      const settings = await database.settings.findMany();
      return settings.reduce((acc, s) => ({
        ...acc,
        [s.key]: s.value,
      }), {});
    },
    async () => {
      // Load from API
      const response = await fetch('https://api.example.com/config');
      return await response.json();
    },
  ],
})
```

## Configuration Service API

```typescript
class ConfigService<T = any> {
  // Get configuration value
  get<K extends keyof T>(key: K): T[K];
  get<K extends keyof T>(key: K, defaultValue: T[K]): T[K];

  // Get all configuration
  getAll(): T;

  // Check if key exists
  has(key: keyof T): boolean;

  // Get with type casting
  getOrThrow<K extends keyof T>(key: K): T[K];
}
```

## Best Practices

### 1. Never Commit Secrets

```gitignore
# .gitignore
.env
.env.local
.env.*.local
```

### 2. Use Environment-Specific Files

```
.env                 # Base configuration
.env.development     # Development overrides
.env.production      # Production overrides
.env.test            # Test overrides
.env.local           # Local overrides (gitignored)
```

### 3. Validate on Startup

```typescript
ConfigModule.forRoot({
  schema: AppConfig,
  validate: true,
  validationOptions: {
    allowUnknown: false,
    abortEarly: false,
  },
})
```

### 4. Use Type-Safe Access

```typescript
// Good - Type-safe
const port = this.config.get('PORT'); // number

// Bad - Not type-safe
const port = process.env.PORT; // string | undefined
```

### 5. Document Required Variables

```typescript
/**
 * Application Configuration
 * 
 * Required Environment Variables:
 * - NODE_ENV: Application environment (development|production|test)
 * - PORT: Server port number
 * - DATABASE_URL: PostgreSQL connection string
 * - JWT_SECRET: Secret key for JWT tokens (min 32 characters)
 * - REDIS_URL: Redis connection string
 */
export class AppConfig {
  // ...
}
```

## Examples

### Complete Example

```typescript
// config/app.config.ts
import { IsString, IsNumber, IsEnum, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class AppConfig {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT: number;

  @IsUrl()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsUrl()
  REDIS_URL: string;

  @IsString()
  OPENAI_API_KEY: string;

  @Transform(({ value }) => value === 'true')
  ENABLE_CACHING: boolean;
}

// app.module.ts
@HazelModule({
  imports: [
    ConfigModule.forRoot({
      schema: AppConfig,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV}`],
      validate: true,
    }),
  ],
})
export class AppModule {}

// database.service.ts
@Injectable()
export class DatabaseService {
  constructor(private config: ConfigService<AppConfig>) {}

  async connect() {
    const url = this.config.get('DATABASE_URL');
    // Connect to database
  }
}
```

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/config)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
