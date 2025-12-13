# @hazeljs/cli

**Command-Line Interface for HazelJS**

Scaffold applications and generate components with a powerful CLI tool for rapid development.

[![npm version](https://img.shields.io/npm/v/@hazeljs/cli.svg)](https://www.npmjs.com/package/@hazeljs/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **Project Scaffolding** - Create new HazelJS applications instantly
- 🎨 **Code Generation** - Generate controllers, services, modules, and more
- 🏗️ **Best Practices** - Generated code follows HazelJS conventions
- 🔧 **Customizable** - Specify paths and options for generated files
- 📦 **Multiple Templates** - Support for various component types
- ⚡ **Fast Development** - Reduce boilerplate and speed up development
- 🎯 **TypeScript First** - All generated code is fully typed

## Installation

### Global Installation (Recommended)

```bash
npm install -g @hazeljs/cli
```

### Local Installation

```bash
npm install --save-dev @hazeljs/cli
```

## Usage

The CLI provides commands to generate various HazelJS components and create new applications:

### Create New Application

```bash
hazel new <appName> [options]
```

Creates a new HazelJS application from a template.

### Generate Components

```bash
hazel generate <component> <name> [options]
```

Or using the shorter alias:

```bash
hazel g <component> <name> [options]
```

### Available Components

#### Core Components
- `controller` / `c`: Generate a new controller
- `service` / `s`: Generate a new service
- `module` / `m`: Generate a new module
- `dto`: Generate create and update DTOs
- `guard` / `g`: Generate a new guard
- `interceptor` / `i`: Generate a new interceptor

#### Advanced Features
- `gateway` / `ws`: Generate a WebSocket gateway
- `filter` / `f`: Generate an exception filter
- `pipe` / `p`: Generate a transformation pipe
- `repository` / `repo`: Generate a Prisma repository
- `ai-service` / `ai`: Generate an AI service with decorators
- `serverless` / `sls`: Generate a serverless handler (Lambda/Cloud Function)

### Options

- `-p, --path <path>`: Specify the path where the component should be generated (default: 'src')
- `--platform <platform>`: For serverless, specify platform: `lambda` or `cloud-function` (default: 'lambda')

### Examples

#### Core Components

Generate a new user controller:
```bash
hazel g controller user
```

Generate a new auth service in a specific path:
```bash
hazel g service auth -p src/auth
```

Generate create and update DTOs for a product:
```bash
hazel g dto product
```

Generate a new authentication guard:
```bash
hazel g guard auth
```

Generate a new logging interceptor:
```bash
hazel g interceptor logging
```

#### Advanced Features

Generate a WebSocket gateway:
```bash
hazel g gateway notifications
# or
hazel g ws notifications
```

Generate an exception filter:
```bash
hazel g filter http-exception
# or
hazel g f http-exception
```

Generate a validation pipe:
```bash
hazel g pipe validation
# or
hazel g p validation
```

Generate a Prisma repository:
```bash
hazel g repository user
# or
hazel g repo user
```

Generate an AI service:
```bash
hazel g ai-service chat
# or
hazel g ai chat
```

Generate a Lambda handler:
```bash
hazel g serverless handler --platform lambda
# or
hazel g sls handler
```

Generate a Cloud Function handler:
```bash
hazel g serverless handler --platform cloud-function
```

## Generated File Structure

### Controller

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param } from '@hazeljs/core';
import { UserService } from './user.service';

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  create(@Body() createDto: any) {
    return this.userService.create(createDto);
  }

  @Put('/:id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return this.userService.update(id, updateDto);
  }

  @Delete('/:id')
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
```

### Service

```typescript
import { Injectable } from '@hazeljs/core';

@Injectable()
export class UserService {
  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  create(data: any) {
    return { id: '1', ...data };
  }

  update(id: string, data: any) {
    return { id, ...data };
  }

  delete(id: string) {
    return { id };
  }
}
```

### Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@HazelModule({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

### DTO

```typescript
import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;
}

export class UpdateUserDto {
  @IsEmail()
  email?: string;

  @IsString()
  name?: string;
}
```

## Best Practices

1. **Organize by Feature** - Group related components in feature modules
2. **Use DTOs** - Always generate and use DTOs for validation
3. **Follow Naming Conventions** - Use singular names for entities (User, not Users)
4. **Specify Paths** - Use `-p` flag to organize files properly
5. **Generate Complete Features** - Generate controller, service, module, and DTOs together

## Common Workflows

### Create a Complete CRUD Feature

```bash
# Generate all components for a User feature
hazel g module user -p src/user
hazel g controller user -p src/user
hazel g service user -p src/user
hazel g dto user -p src/user
```

### Create a Microservice

```bash
# Create new app
hazel new my-microservice

# Generate components
cd my-microservice
hazel g module api -p src/api
hazel g controller api -p src/api
hazel g service api -p src/api
```

### Add WebSocket Support

```bash
# Generate WebSocket gateway
hazel g gateway chat -p src/chat
hazel g service chat -p src/chat
```

### Add AI Integration

```bash
# Generate AI service
hazel g ai-service assistant -p src/ai
```

### Prepare for Serverless

```bash
# Generate Lambda handler
hazel g serverless handler --platform lambda
```

## Configuration

Create a `.hazelrc.json` file in your project root for custom configuration:

```json
{
  "defaultPath": "src",
  "typescript": true,
  "generateTests": true,
  "styleGuide": "airbnb"
}
```

## Tips & Tricks

### Use Aliases

```bash
# These are equivalent
hazel generate controller user
hazel g c user
```

### Batch Generation

```bash
# Generate multiple components at once
hazel g controller user && hazel g service user && hazel g module user
```

### Custom Paths

```bash
# Organize by feature
hazel g controller user -p src/features/user
hazel g service user -p src/features/user
```

## Troubleshooting

### Command Not Found

If `hazel` command is not found after global installation:

```bash
# Check npm global bin path
npm config get prefix

# Add to PATH (macOS/Linux)
export PATH="$(npm config get prefix)/bin:$PATH"

# Or reinstall globally
npm install -g @hazeljs/cli
```

### Permission Errors

```bash
# Use sudo (not recommended)
sudo npm install -g @hazeljs/cli

# Or fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Examples

See the [examples](../../example) directory for complete working examples of generated code.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/cli)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/hazeljs)