# Demo Module

Demonstrates HazelJS v0.2.0 features:

## Endpoints

### Optional Parameters
- `GET /demo/optional/:id?`

### Wildcard Routes
- `GET /demo/wildcard/*`

### Scoped Providers
- `GET /demo/scoped`

### Configuration
- `GET /demo/config`

### API Versioning
- `GET /v1/demo/versioned`
- `GET /v2/demo/versioned`

## Testing

```bash
npm test -- demo.controller.test.ts
```
