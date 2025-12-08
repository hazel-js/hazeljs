# HazelJS CLI

A command-line interface for generating HazelJS components and scaffolding applications.

## Installation

```bash
npm install -g @hazeljs/cli
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

## License

MIT 