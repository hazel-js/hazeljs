# @hazeljs/swagger

OpenAPI 3.0 documents and Swagger UI for HazelJS: class-level `@Swagger`, method-level `@ApiOperation`, automatic operation stubs for undocumented routes, and a small runtime config API.

[![npm version](https://img.shields.io/npm/v/@hazeljs/swagger.svg)](https://www.npmjs.com/package/@hazeljs/swagger)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Installation

```bash
npm install @hazeljs/swagger @hazeljs/core
```

## Quick start

### 1. Import the module and register your app root

```typescript
import { HazelModule } from '@hazeljs/core';
import { SwaggerModule } from '@hazeljs/swagger';

@HazelModule({
  imports: [SwaggerModule],
  controllers: [/* ... */],
})
export class AppModule {}

// After you create the app (e.g. where you bootstrap HazelApp):
SwaggerModule.setRootModule(AppModule);
```

### 2. Optional: document metadata, servers, auth, UI CDN, global prefix

```typescript
SwaggerModule.configure({
  title: 'My API',
  description: 'Production API',
  version: '1.0.0',
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
  globalPrefix: '/api', // match app.setGlobalPrefix('/api') so paths and Swagger UI spec URL align
  securitySchemes: {
    bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  },
  security: [{ bearer: [] }],
  swaggerUiCdnBase: 'https://unpkg.com/swagger-ui-dist@5.11.0',
});

// Replace all options (e.g. in tests):
SwaggerModule.configure({}, true);
```

### 3. Decorate controllers

```typescript
import { Controller, Get, Post, Body } from '@hazeljs/core';
import { Swagger, ApiOperation } from '@hazeljs/swagger';

@Swagger({
  title: 'Users API',
  description: 'User operations',
  version: '1.0.0',
  tags: [{ name: 'users', description: 'Users' }],
})
@Controller({ path: '/users' })
export class UserController {
  @Get()
  @ApiOperation({
    summary: 'List users',
    responses: { '200': { description: 'OK' } },
  })
  list() {
    return [];
  }

  @Post()
  @ApiOperation({
    summary: 'Create user',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '201': { description: 'Created' } },
  })
  create(@Body() body: unknown) {
    return body;
  }
}
```

Routes **without** `@ApiOperation` still appear in the spec when `autoGenerateOperations` is true (default): summaries and placeholder request bodies are inferred from HTTP method and handler name. Set `autoGenerateOperations: false` in `SwaggerModule.configure` or pass `{ autoGenerateOperations: false }` to `SwaggerService.generateSpec` to disable that for programmatic builds.

### 4. Open the UI and raw spec

- **Swagger UI:** `GET /swagger/` (or `GET {globalPrefix}/swagger/` if configured)
- **OpenAPI JSON:** `GET /swagger/spec`

## Programmatic export (CI / codegen)

```typescript
import { createOpenApiDocument } from '@hazeljs/swagger';
import { AppModule } from './app.module';
import * as fs from 'node:fs';

const doc = createOpenApiDocument(AppModule, {
  title: 'My API',
  version: '1.0.0',
  globalPrefix: '/api',
});
fs.writeFileSync('openapi.json', JSON.stringify(doc, null, 2));
```

YAML is not built in; pipe JSON through your preferred YAML tool if needed.

## API reference

| Export | Role |
|--------|------|
| `SwaggerModule` | Nest-style module; `setRootModule`, `configure`, `getOptions` |
| `SwaggerService` | `generateAutoSpec(module, options?)`, `generateSpec(controllers, options?)` |
| `createOpenApiDocument` | Stateless helper around `generateAutoSpec` |
| `@Swagger` | Class-level OpenAPI `info` / default `tags` |
| `@ApiOperation` | Per-route operation (summary, parameters, requestBody, responses) |

Default components include `Error` and `ValidationError` schemas. Auto-generated error responses reference `#/components/schemas/Error`.

## Roadmap / not implemented

The following are **not** in this package today (do not rely on READMEs or examples that mention Nest’s full `@nestjs/swagger` surface):

- `@ApiTags`, `@ApiResponse`, `@ApiProperty`, `@ApiParam`, `@ApiQuery`, `@ApiBody`, `@ApiHeader`, `@ApiBearerAuth`, `@ApiSecurity` as separate decorators
- DTO / class reflection for schemas
- Built-in YAML export or `SwaggerModule.forRoot` static module factory

Contributions welcome for any of the above.

## Testing

```bash
npm test
```

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)
