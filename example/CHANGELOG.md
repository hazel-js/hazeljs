# Example Application Changelog

## v0.2.0 - December 2024

### Added
- **ConfigModule Integration** - Added ConfigModule to AppModule for centralized configuration
- **Demo Module** - New module showcasing all v0.2.0 features:
  - `DemoController` - Demonstrates optional params, wildcards, scoped providers, and config
  - `DemoV1Controller` - API versioning example (v1)
  - `DemoV2Controller` - API versioning example (v2)
  - `DemoService` - Request-scoped service example
  - Comprehensive tests for demo module
  - README documentation for demo features

### Changed
- Updated `AppModule` to use `ConfigModule.forRoot()` with global configuration
- Updated example README to highlight new v0.2.0 features
- Made Swagger `responses` field optional for simpler API documentation

### Features Demonstrated

#### 1. Optional Route Parameters
```typescript
@Get('/optional/:id?')
async optionalParam(@Param('id') id?: string) {
  // id is optional
}
```

#### 2. Wildcard Routes
```typescript
@Get('/wildcard/*')
async wildcardRoute(@Param('*') path: string) {
  // Matches any path after /wildcard/
}
```

#### 3. Request-Scoped Providers
```typescript
@Injectable({ scope: Scope.REQUEST })
export class DemoService {
  // New instance per request
}
```

#### 4. Configuration Service
```typescript
constructor(private config: ConfigService) {
  const value = this.config.get('KEY', 'default');
}
```

#### 5. API Versioning
```typescript
@Controller({ path: '/demo/versioned' })
@Version('1')
export class DemoV1Controller {
  // Version 1 endpoints
}

@Controller({ path: '/demo/versioned' })
@Version('2')
export class DemoV2Controller {
  // Version 2 endpoints
}
```

### Testing
- Added comprehensive unit tests for demo module
- Demonstrates testing utilities with provider mocking
- Shows how to test request-scoped services

### Endpoints Added

| Method | Path | Description |
|--------|------|-------------|
| GET | `/demo/optional/:id?` | Optional parameter example |
| GET | `/demo/wildcard/*` | Wildcard route example |
| GET | `/demo/scoped` | Request-scoped provider example |
| GET | `/demo/config` | Configuration service example |
| GET | `/v1/demo/versioned` | API version 1 |
| GET | `/v2/demo/versioned` | API version 2 |

### Running the Example

```bash
# Install dependencies
npm install

# Start the application
npm run dev

# Run tests
npm test

# Test demo endpoints
curl http://localhost:3000/demo/optional
curl http://localhost:3000/demo/optional/123
curl http://localhost:3000/demo/wildcard/any/path
curl http://localhost:3000/demo/scoped
curl http://localhost:3000/demo/config
curl http://localhost:3000/v1/demo/versioned
curl http://localhost:3000/v2/demo/versioned
```

### Documentation
- See `/src/demo/README.md` for demo module documentation
- See main project `IMPROVEMENTS.md` for detailed feature documentation
- See main project `QUICKSTART.md` for getting started guide

## v0.1.0 - Initial Release

### Features
- User module with CRUD operations
- Auth module with JWT authentication
- AI module with OpenAI integration
- Prisma database integration
- Swagger documentation
- Validation pipes
- Guards and interceptors
