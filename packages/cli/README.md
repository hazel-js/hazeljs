# @hazeljs/cli

**Command-Line Interface for HazelJS**

Scaffold applications and generate components with a powerful CLI tool for rapid development.

[![npm version](https://img.shields.io/npm/v/@hazeljs/cli.svg)](https://www.npmjs.com/package/@hazeljs/cli)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🚀 **Project Scaffolding** - Create new HazelJS applications instantly with interactive setup
- 🎨 **Code Generation** - Generate controllers, services, modules, and more
- 🏗️ **Best Practices** - Generated code follows HazelJS conventions
- 🔧 **Customizable** - Specify paths and options for generated files
- 📦 **Multiple Templates** - Support for various component types
- ⚡ **Fast Development** - Reduce boilerplate and speed up development
- 🎯 **TypeScript First** - All generated code is fully typed
- 🛠️ **Utility Commands** - Build, start, test, and manage your project
- 📊 **Project Info** - Display comprehensive project information
- ➕ **Package Management** - Add HazelJS packages interactively
- 🎭 **CRUD Generator** - Generate complete CRUD resources in one command

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

The CLI provides commands to generate various HazelJS components, create new applications, and manage your project.

## Commands

### Project Management

#### Create New Application

```bash
hazel new <appName> [options]
```

Creates a new HazelJS application with optional interactive setup.

**Options:**
- `-d, --dest <path>` - Destination path (default: current directory)
- `-i, --interactive` - Interactive setup with package selection
- `--skip-install` - Skip npm install
- `--skip-git` - Skip git initialization

**Examples:**
```bash
# Basic project creation
hazel new my-app

# Interactive setup with package selection
hazel new my-app -i

# Create without installing dependencies
hazel new my-app --skip-install
```

#### Project Information

```bash
hazel info
```

Display comprehensive information about your HazelJS project including:
- Project name, version, and description
- Installed HazelJS packages
- Project structure
- Environment details
- Configuration files

#### Add Packages

```bash
hazel add [package]
```

Add HazelJS packages to your project interactively.

**Examples:**
```bash
# Interactive package selection
hazel add

# Add specific package
hazel add ai
hazel add auth
hazel add prisma
```

**Available packages:**
- `ai` - AI Integration (@hazeljs/ai)
- `auth` - Authentication (@hazeljs/auth)
- `cache` - Caching (@hazeljs/cache)
- `config` - Configuration (@hazeljs/config)
- `cron` - Cron Jobs (@hazeljs/cron)
- `prisma` - Prisma ORM (@hazeljs/prisma)
- `rag` - RAG/Vector Search (@hazeljs/rag)
- `serverless` - Serverless (@hazeljs/serverless)
- `swagger` - Swagger/OpenAPI (@hazeljs/swagger)
- `websocket` - WebSocket (@hazeljs/websocket)

#### Build Project

```bash
hazel build [options]
```

Build your HazelJS project.

**Options:**
- `-w, --watch` - Watch mode
- `-p, --production` - Production build

**Examples:**
```bash
# Standard build
hazel build

# Watch mode
hazel build -w

# Production build
hazel build -p
```

#### Start Application

```bash
hazel start [options]
```

Start your HazelJS application.

**Options:**
- `-d, --dev` - Start in development mode
- `-p, --port <port>` - Specify port

**Examples:**
```bash
# Start in production mode
hazel start

# Start in development mode with hot reload
hazel start -d

# Start on specific port
hazel start -p 8080
```

#### Run Tests

```bash
hazel test [pattern] [options]
```

Run tests for your HazelJS project.

**Options:**
- `-w, --watch` - Watch mode
- `-c, --coverage` - Generate coverage report
- `--ci` - Run in CI mode

**Examples:**
```bash
# Run all tests
hazel test

# Run specific test file
hazel test user.test

# Watch mode
hazel test -w

# Generate coverage
hazel test -c
```

### Code Generation

```bash
hazel generate <component> <name> [options]
```

Or using the shorter alias:

```bash
hazel g <component> <name> [options]
```

### Available Generators

#### Core Components
- `controller` / `c` - Generate a new controller
- `service` / `s` - Generate a new service
- `module` / `m` - Generate a new module
- `dto` - Generate create and update DTOs
- `guard` - Generate a new guard
- `interceptor` / `i` - Generate a new interceptor
- `middleware` / `mw` - Generate a new middleware

#### Advanced Generators
- **`crud`** - Generate complete CRUD resource (controller + service + module + DTOs)
- `gateway` / `ws` - Generate a WebSocket gateway
- `filter` / `f` - Generate an exception filter
- `pipe` / `p` - Generate a transformation pipe
- `repository` / `repo` - Generate a Prisma repository
- `ai-service` / `ai` - Generate an AI service with decorators
- `serverless` / `sls` - Generate a serverless handler (Lambda/Cloud Function)

### Generator Options

- `-p, --path <path>` - Specify the path where the component should be generated (default: 'src')
- `-r, --route <route>` - Specify the route path (for CRUD generator)
- `--platform <platform>` - For serverless, specify platform: `lambda` or `cloud-function` (default: 'lambda')

### Generator Examples

#### CRUD Generator (Recommended)

Generate a complete CRUD resource with controller, service, module, and DTOs:
```bash
hazel g crud user

# With custom path
hazel g crud product -p src/products

# With custom route
hazel g crud article -r /api/articles
```

This creates:
- `user.controller.ts` - Full CRUD controller
- `user.service.ts` - Service with all CRUD methods
- `user.module.ts` - Module configuration
- `dto/user.dto.ts` - Create and Update DTOs

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

Generate a new middleware:
```bash
hazel g middleware logging
# or
hazel g mw cors -p src/middleware
```

#### Advanced Generators

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

**Option 1: Using CRUD Generator (Recommended)**
```bash
# Generate everything in one command
hazel g crud user -p src/user
```

**Option 2: Manual Generation**
```bash
# Generate all components separately
hazel g module user -p src/user
hazel g controller user -p src/user
hazel g service user -p src/user
hazel g dto user -p src/user
```

### Create a Microservice

```bash
# Create new app with interactive setup
hazel new my-microservice -i

# Navigate to project
cd my-microservice

# Generate CRUD resources
hazel g crud user
hazel g crud product
hazel g crud order

# Add additional packages
hazel add swagger
hazel add auth

# Start development
hazel start -d
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

## Quick Reference

### All Available Commands

```bash
# Project Management
hazel new <name> [-i]              # Create new project
hazel info                         # Show project info
hazel add [package]                # Add HazelJS packages
hazel build [-w] [-p]              # Build project
hazel start [-d] [-p <port>]       # Start application
hazel test [pattern] [-w] [-c]     # Run tests

# Code Generation (alias: g)
hazel g crud <name>                # Complete CRUD resource
hazel g controller <name>          # Controller
hazel g service <name>             # Service
hazel g module <name>              # Module
hazel g middleware <name>          # Middleware
hazel g guard <name>               # Guard
hazel g interceptor <name>         # Interceptor
hazel g filter <name>              # Exception filter
hazel g pipe <name>                # Pipe
hazel g dto <name>                 # DTOs
hazel g repository <name>          # Prisma repository
hazel g ai-service <name>          # AI service
hazel g gateway <name>             # WebSocket gateway
hazel g serverless <name>          # Serverless handler
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

# CRUD generator is the fastest way
hazel g crud user
```

### Interactive Setup

```bash
# Use interactive mode for new projects
hazel new my-app -i

# Select packages interactively
hazel add
```

### Batch Generation

```bash
# Use CRUD generator instead of multiple commands
hazel g crud user  # Better than:
# hazel g controller user && hazel g service user && hazel g module user && hazel g dto user
```

### Custom Paths

```bash
# Organize by feature
hazel g crud user -p src/features/user
hazel g middleware logging -p src/common/middleware
```

### Development Workflow

```bash
# Quick development cycle
hazel new my-app -i          # Create with interactive setup
cd my-app
hazel g crud user            # Generate CRUD resource
hazel add swagger            # Add API documentation
hazel start -d               # Start in dev mode

# In another terminal
hazel test -w                # Run tests in watch mode
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

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/cli)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/hazeljs)