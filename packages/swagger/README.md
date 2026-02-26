# @hazeljs/swagger

**Swagger/OpenAPI Documentation Module for HazelJS**

Auto-generate interactive API documentation with Swagger UI and OpenAPI specifications.

[![npm version](https://img.shields.io/npm/v/@hazeljs/swagger.svg)](https://www.npmjs.com/package/@hazeljs/swagger)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/swagger)](https://www.npmjs.com/package/@hazeljs/swagger)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 📚 **Auto-Generated Docs** - Automatic OpenAPI spec generation
- 🎨 **Swagger UI** - Interactive API explorer
- 🏷️ **Decorator-Based** - Document APIs with decorators
- 📝 **Type Safety** - TypeScript integration
- 🔐 **Authentication** - Document auth requirements
- 📊 **Request/Response Examples** - Add example payloads
- 🎯 **Tags & Groups** - Organize endpoints
- 🔄 **Multiple Formats** - JSON, YAML export

## Installation

```bash
npm install @hazeljs/swagger
```

## Quick Start

### 1. Configure Swagger Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { SwaggerModule } from '@hazeljs/swagger';

@HazelModule({
  imports: [
    SwaggerModule.forRoot({
      title: 'My API',
      description: 'API documentation',
      version: '1.0.0',
      path: '/api-docs',
    }),
  ],
})
export class AppModule {}
```

### 2. Document Controllers

```typescript
import { Controller, Get, Post, Body, Param } from '@hazeljs/core';
import { ApiOperation, ApiResponse, ApiTags } from '@hazeljs/swagger';

@Controller('/users')
@ApiTags('Users')
export class UserController {
  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll() {
    return { users: [] };
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return { id, name: 'John Doe' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Body() createUserDto: CreateUserDto) {
    return createUserDto;
  }
}
```

### 3. Access Documentation

Navigate to `http://localhost:3000/api-docs` to view the interactive Swagger UI.

## Decorators

### @ApiTags()

Group endpoints by tags:

```typescript
@Controller('/products')
@ApiTags('Products', 'Catalog')
export class ProductController {
  // All endpoints will be tagged with 'Products' and 'Catalog'
}
```

### @ApiOperation()

Document endpoint details:

```typescript
@Get('/search')
@ApiOperation({
  summary: 'Search products',
  description: 'Search for products by name, category, or tags',
  operationId: 'searchProducts',
})
searchProducts() {
  return [];
}
```

### @ApiResponse()

Document response types:

```typescript
@Get('/:id')
@ApiResponse({
  status: 200,
  description: 'Product found',
  type: ProductDto,
})
@ApiResponse({
  status: 404,
  description: 'Product not found',
  schema: {
    type: 'object',
    properties: {
      statusCode: { type: 'number' },
      message: { type: 'string' },
    },
  },
})
findOne(@Param('id') id: string) {
  return this.productService.findOne(id);
}
```

### @ApiProperty()

Document DTO properties:

```typescript
import { ApiProperty } from '@hazeljs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User password',
    minLength: 8,
    example: 'SecurePass123!',
  })
  password: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User age',
    minimum: 18,
    maximum: 120,
    example: 25,
    required: false,
  })
  age?: number;
}
```

### @ApiParam()

Document path parameters:

```typescript
@Get('/:id')
@ApiParam({
  name: 'id',
  description: 'User ID',
  type: 'string',
  example: '123',
})
findOne(@Param('id') id: string) {
  return this.userService.findOne(id);
}
```

### @ApiQuery()

Document query parameters:

```typescript
@Get()
@ApiQuery({
  name: 'page',
  required: false,
  type: Number,
  description: 'Page number',
  example: 1,
})
@ApiQuery({
  name: 'limit',
  required: false,
  type: Number,
  description: 'Items per page',
  example: 10,
})
findAll(
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 10
) {
  return this.userService.findAll(page, limit);
}
```

### @ApiBody()

Document request body:

```typescript
@Post()
@ApiBody({
  description: 'User data',
  type: CreateUserDto,
  examples: {
    user1: {
      summary: 'Example user',
      value: {
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      },
    },
  },
})
create(@Body() createUserDto: CreateUserDto) {
  return this.userService.create(createUserDto);
}
```

### @ApiHeader()

Document required headers:

```typescript
@Get('/protected')
@ApiHeader({
  name: 'Authorization',
  description: 'Bearer token',
  required: true,
  example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
})
getProtectedData() {
  return { data: 'protected' };
}
```

### @ApiBearerAuth()

Document bearer authentication:

```typescript
@Controller('/admin')
@ApiBearerAuth()
export class AdminController {
  @Get('/dashboard')
  getDashboard() {
    return { data: 'admin dashboard' };
  }
}
```

### @ApiSecurity()

Document custom security:

```typescript
@Controller('/api')
@ApiSecurity('api_key')
export class ApiController {
  @Get('/data')
  getData() {
    return { data: [] };
  }
}
```

## Configuration

### Full Configuration

```typescript
SwaggerModule.forRoot({
  // Basic info
  title: 'My API',
  description: 'Comprehensive API documentation',
  version: '1.0.0',
  
  // Server info
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.example.com',
      description: 'Production server',
    },
  ],
  
  // Contact info
  contact: {
    name: 'API Support',
    email: 'support@example.com',
    url: 'https://example.com/support',
  },
  
  // License
  license: {
    name: 'Apache-2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
  },
  
  // Terms of service
  termsOfService: 'https://example.com/terms',
  
  // External docs
  externalDocs: {
    description: 'Find more info here',
    url: 'https://docs.example.com',
  },
  
  // Security schemes
  security: [
    {
      name: 'bearer',
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    {
      name: 'api_key',
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    },
  ],
  
  // Swagger UI options
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
  },
  
  // Path to serve docs
  path: '/api-docs',
  
  // Custom CSS
  customCss: '.swagger-ui .topbar { display: none }',
  
  // Custom site title
  customSiteTitle: 'My API Documentation',
})
```

## Authentication

### JWT Bearer

```typescript
// Configure security scheme
SwaggerModule.forRoot({
  security: [
    {
      name: 'bearer',
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  ],
});

// Use in controller
@Controller('/protected')
@ApiBearerAuth()
export class ProtectedController {
  @Get()
  getData() {
    return { data: 'protected' };
  }
}
```

### API Key

```typescript
// Configure security scheme
SwaggerModule.forRoot({
  security: [
    {
      name: 'api_key',
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    },
  ],
});

// Use in controller
@Controller('/api')
@ApiSecurity('api_key')
export class ApiController {
  @Get()
  getData() {
    return { data: [] };
  }
}
```

### OAuth2

```typescript
SwaggerModule.forRoot({
  security: [
    {
      name: 'oauth2',
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://example.com/oauth/authorize',
          tokenUrl: 'https://example.com/oauth/token',
          scopes: {
            'read:users': 'Read user information',
            'write:users': 'Modify user information',
          },
        },
      },
    },
  ],
});
```

## Examples

### Complete CRUD Example

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param } from '@hazeljs/core';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@hazeljs/swagger';

@Controller('/products')
@ApiTags('Products')
@ApiBearerAuth()
export class ProductController {
  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({
    status: 200,
    description: 'List of products',
    type: [ProductDto],
  })
  findAll() {
    return this.productService.findAll();
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product found', type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Product created', type: ProductDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product updated', type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  delete(@Param('id') id: string) {
    return this.productService.delete(id);
  }
}
```

## Export OpenAPI Spec

### JSON Format

```typescript
import { SwaggerModule } from '@hazeljs/swagger';

const document = SwaggerModule.createDocument(app);
const json = JSON.stringify(document, null, 2);

// Save to file
fs.writeFileSync('./openapi.json', json);
```

### YAML Format

```typescript
import { SwaggerModule } from '@hazeljs/swagger';
import * as yaml from 'js-yaml';

const document = SwaggerModule.createDocument(app);
const yamlString = yaml.dump(document);

// Save to file
fs.writeFileSync('./openapi.yaml', yamlString);
```

## Best Practices

1. **Document All Endpoints** - Add decorators to every route
2. **Use DTOs** - Define request/response types with `@ApiProperty`
3. **Add Examples** - Include realistic examples in documentation
4. **Group by Tags** - Organize endpoints with `@ApiTags`
5. **Document Errors** - Include all possible error responses
6. **Security** - Document authentication requirements
7. **Versioning** - Update version number with API changes
8. **External Docs** - Link to additional documentation

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/swagger)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
