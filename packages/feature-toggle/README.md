# @hazeljs/feature-toggle

**Feature flags with one decorator. Protect routes or branch in code.**

In-memory flags, optional env seeding, and `@FeatureToggle('name')` on controllers or methods. When the flag is off, the route returns 403. No external SDK — just core.

[![npm version](https://img.shields.io/npm/v/@hazeljs/feature-toggle.svg)](https://www.npmjs.com/package/@hazeljs/feature-toggle)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/feature-toggle)](https://www.npmjs.com/package/@hazeljs/feature-toggle)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Decorator-first** – `@FeatureToggle('name')` on a controller or method; no manual guards
- **In-memory** – Simple flag store; optional seed from `initialFlags` or env prefix
- **Env integration** – Use `envPrefix` (e.g. `FEATURE_`) to load flags from environment variables
- **Programmatic API** – Inject `FeatureToggleService` and call `isEnabled()`, `set()`, `get()`
- **TypeScript** – Full type support, no extra dependencies beyond `@hazeljs/core`

## Installation

```bash
npm install @hazeljs/feature-toggle
```

## Quick Start

### 1. Register the module

```typescript
import { HazelModule } from '@hazeljs/core';
import { FeatureToggleModule } from '@hazeljs/feature-toggle';

@HazelModule({
  imports: [
    FeatureToggleModule.forRoot({
      initialFlags: { newCheckout: true },
      envPrefix: 'FEATURE_', // FEATURE_X from env → flag "x"
    }),
  ],
})
export class AppModule {}
```

### 2. Protect routes with the decorator

```typescript
import { Controller, Get } from '@hazeljs/core';
import { FeatureToggle } from '@hazeljs/feature-toggle';

@Controller('checkout')
export class CheckoutController {
  @Get('new')
  @FeatureToggle('newCheckout')
  getNewCheckout() {
    return { flow: 'new' };
  }

  @Get('legacy')
  getLegacyCheckout() {
    return { flow: 'legacy' };
  }
}

// Or require the flag for the whole controller:
@Controller('beta')
@FeatureToggle('betaApi')
export class BetaController {
  @Get()
  index() {
    return { message: 'Beta API' };
  }
}
```

### 3. Use in services (programmatic)

```typescript
import { Service } from '@hazeljs/core';
import { FeatureToggleService } from '@hazeljs/feature-toggle';

@Service()
export class OrderService {
  constructor(private readonly featureToggle: FeatureToggleService) {}

  createOrder(data: OrderData) {
    if (this.featureToggle.isEnabled('newCheckout')) {
      return this.createWithNewFlow(data);
    }
    return this.createWithLegacyFlow(data);
  }
}
```

## API

### FeatureToggleModule

- **`FeatureToggleModule.forRoot(options?)`**  
  Registers the module. Options:
  - `initialFlags?: Record<string, boolean>` – Flags to set on load
  - `envPrefix?: string` – Env var prefix (e.g. `FEATURE_`); vars like `FEATURE_NEW_UI` become flag `newUi`. Values `true`, `1`, `yes` (case-insensitive) → `true`.

### FeatureToggleService

- **`isEnabled(name: string): boolean`** – Returns whether the flag is on (default `false` if unset).
- **`get(name: string): boolean | undefined`** – Raw value; `undefined` if not set.
- **`set(name: string, value: boolean): void`** – Set or override a flag at runtime (in-memory).

### Decorator

- **`@FeatureToggle(featureName: string)`** – Method or class decorator. Applies a guard so that when the flag is disabled, the request is rejected (403) and the handler is not run.

## Environment variables

With `envPrefix: 'FEATURE_'`:

```env
FEATURE_NEW_CHECKOUT=true
FEATURE_BETA_API=0
FEATURE_NEW_UI=yes
```

Flag names are derived in camelCase: `FEATURE_NEW_CHECKOUT` → `newCheckout`.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/feature-toggle)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/xe495BvE)
