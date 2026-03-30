# @hazeljs/cli

**From zero to AI-powered apps in one command.**

Generate controllers, services, modules, AI agents, RAG systems — or create a complete AI-Native application with PostgreSQL, Redis, and Docker. Interactive project setup, package management, and code that follows best practices.

[![npm version](https://img.shields.io/npm/v/@hazeljs/cli.svg)](https://www.npmjs.com/package/@hazeljs/cli)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/cli)](https://www.npmjs.com/package/@hazeljs/cli)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🤖 **AI-Native Templates** - Create complete AI applications with agents, RAG, PostgreSQL, and Docker
- 🚀 **Project Scaffolding** - Create new HazelJS applications instantly with interactive setup
- 🎨 **Code Generation** - Generate controllers, services, AI agents, RAG systems, and 20+ component types
- 📦 **Package Management** - Add HazelJS packages interactively with optional setup file generation
- 🏗️ **Best Practices** - Generated code follows HazelJS conventions and AI patterns
- 🎯 **TypeScript First** - All generated code is fully typed
- ⚡ **Fast Development** - Reduce boilerplate and speed up development

## Installation

### Global Installation (Recommended)

```bash
npm install -g @hazeljs/cli
```

### Local Installation

```bash
npm install --save-dev @hazeljs/cli
```

## Commands

### Create a New Application

**AI-Native Application (Recommended for AI Projects):**
```bash
hazel g app my-ai-app --template=ai-native
cd my-ai-app && npm install && cp .env.example .env && docker-compose up -d && npm run dev
```

Creates a complete AI-powered application with agents, RAG (PostgreSQL + pgvector), Redis, and Docker.

**Skeleton app (quick start):**
```bash
hazel g app my-app
cd my-app && npm install && npm run dev
```

**Full setup with interactive package selection:**
```bash
hazel new my-app -i
```

**Options:**
- `-d, --dest <path>` - Destination path (default: current directory)
- `-i, --interactive` - Interactive setup with package selection
- `--template <template>` - Template to use (`ai-native` or `default`)
- `--skip-install` - Skip npm install
- `--skip-git` - Skip git initialization

### Project Info

```bash
hazel info
```

Display project name, version, installed HazelJS packages, project structure, and environment details.

### Add Packages

```bash
hazel add [package] [--setup] [--dev]
```

Install a HazelJS package and show usage hints. Use `--setup` to also generate a minimal starter file.

**Examples:**
```bash
hazel add                  # Interactive package selection
hazel add ai               # Install @hazeljs/ai
hazel add auth --setup     # Install @hazeljs/auth + generate auth.setup.ts
hazel add prisma --dev     # Install as devDependency
```

**Available packages:** `ai`, `agent`, `audit`, `auth`, `oauth`, `cache`, `config`, `cron`, `data`, `discovery`, `event-emitter`, `gateway`, `graphql`, `grpc`, `guardrails`, `kafka`, `mcp`, `messaging`, `ml`, `prisma`, `prompts`, `queue`, `rag`, `resilience`, `pdf-to-audio`, `serverless`, `swagger`, `typeorm`, `websocket`

### Code Generation

```bash
hazel g <type> <name> [--path <path>] [--dry-run] [--json]
```

**Discover generators:**
```bash
hazel g --list              # Human-readable list
hazel g --list --list-json  # JSON output
```

**Common options** (work the same for every generator):
- `-p, --path <path>` - Where to generate (default: `src`)
- `--dry-run` - Preview files without writing them
- `--json` - Output result as JSON (`{ ok, created, nextSteps }`)

#### Multi-File Generators

| Generator | Alias | Description | Creates |
|-----------|-------|-------------|---------|
| `crud <name>` | — | Complete CRUD resource | controller + service + module + DTOs |
| `module <name>` | `m` | Feature module | module + controller + service + DTOs |
| `dto <name>` | `d` | Create & update DTOs | two DTO files |
| `auth` | — | Auth module | JWT guard + service + controller + DTOs |

#### Single-File Generators

| Generator | Alias | Description |
|-----------|-------|-------------|
| `controller <name>` | `c` | REST controller with CRUD methods |
| `service <name>` | `s` | Injectable service class |
| `guard <name>` | `gu` | Route guard (e.g. auth) |
| `interceptor <name>` | `i` | Request/response interceptor |
| `middleware <name>` | `mw` | Express-style middleware |
| `pipe <name>` | — | Validation/transform pipe |
| `filter <name>` | `f` | Exception filter |
| `repository <name>` | `repo` | Prisma repository |
| `gateway <name>` | `ws` | WebSocket gateway |
| `ai-service <name>` | `ai` | AI service with decorators |
| `agent <name>` | — | AI agent with @Agent and @Tool |
| `cache <name>` | — | Cache service with decorators |
| `cron <name>` | `job` | Cron/scheduled job service |
| `rag <name>` | — | RAG service |
| `discovery <name>` | — | Service discovery setup |
| `config` | — | Config module setup |
| `serverless <name>` | `sls` | Serverless handler (Lambda/Cloud Function) |

**Serverless** also accepts `--platform <lambda|cloud-function>` (default: `lambda`).

### Generator Examples

```bash
# CRUD resource (recommended for new features)
hazel g crud user
hazel g crud product -p src/products -r /api/products

# Core components
hazel g controller user
hazel g service auth -p src/auth
hazel g module orders
hazel g dto product

# Infrastructure
hazel g guard auth
hazel g interceptor logging
hazel g middleware cors -p src/middleware
hazel g filter http-exception

# AI components
hazel g ai-service chat
hazel g agent support
hazel g rag knowledge

# Serverless
hazel g serverless handler --platform lambda
hazel g sls api --platform cloud-function
```

## Common Workflows

### Create a Complete CRUD Feature

```bash
# One command — generates controller, service, module, and DTOs
hazel g crud user -p src/user
```

### Create a Microservice

```bash
hazel new my-service -i       # Interactive setup with package selection
cd my-service
hazel g crud user
hazel g crud product
hazel add swagger
npm run dev
```

### Add AI Integration

```bash
hazel add ai --setup
hazel g ai-service assistant -p src/ai
hazel g agent support
```

### Add WebSocket Support

```bash
hazel g gateway chat -p src/chat
hazel g service chat -p src/chat
```

### Prepare for Serverless

```bash
hazel g serverless handler --platform lambda
```

## Quick Reference

```bash
# Project Management
hazel new <name> [-i]                # Create new project
hazel info                           # Show project info
hazel add [package] [--setup]        # Add HazelJS package

# Code Generation (alias: g)
hazel g app <name>                   # Application template
hazel g crud <name>                  # Complete CRUD resource
hazel g controller <name>            # Controller
hazel g service <name>               # Service
hazel g module <name>                # Module (+ controller, service, DTOs)
hazel g guard <name>                 # Guard
hazel g interceptor <name>           # Interceptor
hazel g middleware <name>            # Middleware
hazel g filter <name>                # Exception filter
hazel g pipe <name>                  # Pipe
hazel g dto <name>                   # DTOs
hazel g repository <name>            # Prisma repository
hazel g ai-service <name>            # AI service
hazel g agent <name>                 # AI agent
hazel g gateway <name>               # WebSocket gateway
hazel g cache <name>                 # Cache service
hazel g cron <name>                  # Cron service
hazel g rag <name>                   # RAG service
hazel g discovery <name>             # Service discovery
hazel g config                       # Config module
hazel g serverless <name>            # Serverless handler
hazel g auth                         # Auth module
hazel g --list                       # List all generators
```

## Best Practices

1. **Organize by Feature** - Group related components in feature modules
2. **Use DTOs** - Always generate and use DTOs for validation
3. **Follow Naming Conventions** - Use singular names for entities (User, not Users)
4. **Specify Paths** - Use `-p` flag to organize files properly
5. **Use CRUD Generator** - For new features, `hazel g crud` is the fastest path

## Troubleshooting

### Command Not Found

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
# Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## Development

```bash
npm run build    # Build
npm test         # Run tests
npm run lint     # Lint
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## For LLM Agents & Tool Integration

The CLI includes a machine-readable manifest (`cli-manifest.json`) that enables perfect integration with AI agents:

```bash
# Get all available generators as JSON
hazel g --list --list-json

# Preview changes without writing files
hazel g controller users --dry-run --json

# Get machine-readable output for any command
hazel g service users --json
```

The manifest is automatically generated during build and always reflects the current package version. It includes:
- Complete command schemas with options and arguments
- All available generators with their capabilities  
- Package registry for `hazel add` commands
- JSON schema validation for agent tool-use

## License

Apache-2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/cli)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.com/channels/1448263814238965833/1448263814859456575)