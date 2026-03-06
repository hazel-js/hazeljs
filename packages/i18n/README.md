# @hazeljs/i18n

**Internationalization (i18n) Module for HazelJS - Translate, Format, and Detect Locales**

Zero-dependency i18n for HazelJS with JSON translation files, interpolation, pluralization, and native `Intl.*` formatting.

[![npm version](https://img.shields.io/npm/v/@hazeljs/i18n.svg)](https://www.npmjs.com/package/@hazeljs/i18n)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/i18n)](https://www.npmjs.com/package/@hazeljs/i18n)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Zero heavy dependencies** — uses only Node.js built-ins (`fs/promises`, native `Intl` API)
- **Translation** - JSON-based translation files with dot-notation key lookup
- **Interpolation** - Variable substitution via `{placeholder}` tokens
- **Pluralization** - Native `Intl.PluralRules` for all CLDR plural categories
- **Locale Detection** - Query parameter, cookie, or `Accept-Language` header strategies
- **Formatting** - Number, date, currency, and relative-time via native `Intl.*` APIs
- **`@Lang()` Decorator** - Inject detected locale into controller method parameters
- **`I18nInterceptor`** - Automatic response message translation
- **Async Configuration** - `forRootAsync()` for container-resolved options

## Installation

```bash
npm install @hazeljs/i18n
```

## Quick Start

### 1. Create translation files

```
my-app/
└── translations/
    ├── en.json
    └── fr.json
```

**`translations/en.json`**

```json
{
  "welcome": "Welcome, {name}!",
  "goodbye": "Goodbye!",
  "items": {
    "one": "1 item",
    "other": "{count} items"
  },
  "errors": {
    "notFound": "Resource not found.",
    "unauthorized": "You are not authorized."
  }
}
```

**`translations/fr.json`**

```json
{
  "welcome": "Bienvenue, {name} !",
  "goodbye": "Au revoir !",
  "items": {
    "one": "1 élément",
    "other": "{count} éléments"
  },
  "errors": {
    "notFound": "Ressource introuvable.",
    "unauthorized": "Vous n'êtes pas autorisé."
  }
}
```

### 2. Register the module

```typescript
import { HazelModule } from '@hazeljs/core';
import { I18nModule } from '@hazeljs/i18n';
import { AppController } from './app.controller';

@HazelModule({
  imports: [
    I18nModule.forRoot({
      defaultLocale: 'en',
      fallbackLocale: 'en',
      translationsPath: './translations',
      detection: ['query', 'cookie', 'header'],
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

### 3. Apply locale middleware

Add `LocaleMiddleware` before your routes so every request has a locale attached before controllers execute:

```typescript
import { HazelApp } from '@hazeljs/core';
import { LocaleMiddleware } from '@hazeljs/i18n';

const app = new HazelApp(AppModule);

const localeMw = app.get(LocaleMiddleware);
app.use((req, res, next) => localeMw.handle(req, res, next));

await app.listen(3000);
```

### 4. Use in a controller

```typescript
import { Controller, Get } from '@hazeljs/core';
import { I18nService, Lang } from '@hazeljs/i18n';

@Controller('/greet')
export class AppController {
  constructor(private readonly i18n: I18nService) {}

  @Get('/')
  hello(@Lang() locale: string) {
    return {
      message: this.i18n.t('welcome', { locale, vars: { name: 'Alice' } }),
    };
    // GET /greet?lang=fr  →  { message: "Bienvenue, Alice !" }
    // GET /greet           →  { message: "Welcome, Alice!" }
  }

  @Get('/items')
  items(@Lang() locale: string) {
    const count = 5;
    return {
      message: this.i18n.t('items', { locale, count, vars: { count: String(count) } }),
    };
    // → { message: "5 items" }
  }
}
```

## Async Configuration

Use `forRootAsync` with `ConfigService`:

```typescript
import { ConfigService } from '@hazeljs/config';
import { I18nModule } from '@hazeljs/i18n';

I18nModule.forRootAsync({
  useFactory: async (config: ConfigService) => ({
    defaultLocale: config.get('LOCALE', 'en'),
    translationsPath: config.get('TRANSLATIONS_PATH', './translations'),
  }),
  inject: [ConfigService],
})
```

## API Reference

### I18nModule.forRoot(options)

| Option             | Type                        | Default                      | Description                                     |
|--------------------|-----------------------------|------------------------------|-------------------------------------------------|
| `defaultLocale`    | `string`                    | `'en'`                       | Locale used when none is detected.              |
| `fallbackLocale`   | `string`                    | same as `defaultLocale`      | Locale used when a key is missing.              |
| `translationsPath` | `string`                    | `'./translations'`           | Path to the directory of `<locale>.json` files. |
| `detection`        | `LocaleDetectionStrategy[]` | `['query','cookie','header']`| Ordered locale detection strategies.           |
| `queryParam`       | `string`                    | `'lang'`                     | Query-string parameter name.                    |
| `cookieName`       | `string`                    | `'locale'`                   | Cookie name.                                    |
| `isGlobal`         | `boolean`                   | `true`                       | Register as a global module.                    |

### I18nService

- `t(key, opts?)` - Translate a dot-notation key; supports `vars`, `count`, and `locale` override
- `has(key, locale?)` - Check whether a translation key exists
- `getLocales()` - Return all loaded locale codes
- `getKeys(locale?)` - Return all flattened dot-notation keys for a locale

```typescript
i18n.t('errors.notFound')
// → "Resource not found."

i18n.t('welcome', { vars: { name: 'Bob' } })
// → "Welcome, Bob!"

i18n.t('items', { count: 3, vars: { count: '3' } })
// → "3 items"

i18n.t('welcome', { locale: 'fr', vars: { name: 'Bob' } })
// → "Bienvenue, Bob !"
```

### I18nFormatter (`i18n.format.*`)

- `number(value, locale?, opts?)` - Format a number via `Intl.NumberFormat`
- `date(value, locale?, opts?)` - Format a date via `Intl.DateTimeFormat`
- `currency(value, locale?, currency?)` - Format a monetary value
- `relative(value, unit, locale?, opts?)` - Format a relative time via `Intl.RelativeTimeFormat`

```typescript
i18n.format.number(1234567.89, 'de', { maximumFractionDigits: 2 })
// → "1.234.567,89"

i18n.format.date(new Date(), 'fr', { dateStyle: 'long' })
// → "4 mars 2026"

i18n.format.currency(49.99, 'en', 'USD')
// → "$49.99"

i18n.format.relative(-3, 'day', 'en')
// → "3 days ago"
```

### Decorators

- `@Lang()` - Inject the request locale into a controller method parameter

```typescript
@Get('/hello')
greet(@Lang() locale: string) {
  return this.i18n.t('welcome', { locale, vars: { name: 'World' } });
}
```

### LocaleMiddleware

Detects the request locale and stores it on the request object. Sets the `Content-Language` response header.

**Detection order (configurable):**

1. Query parameter (`?lang=fr`)
2. Cookie (`locale=fr`)
3. `Accept-Language` header (`Accept-Language: fr-FR,fr;q=0.9,en;q=0.8`)
4. `defaultLocale` fallback

```typescript
// Manual registration
app.use((req, res, next) => localeMw.handle(req, res, next));

// Or use the static factory
app.use(LocaleMiddleware.create(resolvedOptions));
```

### I18nInterceptor

Optional interceptor that automatically translates a `message` field in the response when the value matches an i18n key.

```typescript
import { UseInterceptors } from '@hazeljs/core';
import { I18nInterceptor } from '@hazeljs/i18n';

@Controller('/users')
@UseInterceptors(I18nInterceptor)
export class UserController {
  @Post('/')
  create() {
    return { message: 'user.created', data: { id: 1 } };
    // → { message: 'User created successfully.', data: { id: 1 } }
  }
}
```

## Translation File Format

Files must be valid JSON named `<locale>.json`. Keys can be nested to create namespaces. Leaf values are plain strings or **plural objects**:

```json
{
  "flat_key": "A simple string.",
  "interpolated": "Hello, {name}!",
  "namespace": {
    "nested_key": "Nested value."
  },
  "plural": {
    "one": "One apple",
    "other": "{count} apples"
  }
}
```

Dot-notation resolves nested keys: `i18n.t('namespace.nested_key')`.

Plural objects support any CLDR plural category (`zero`, `one`, `two`, `few`, `many`, `other`) as determined by `Intl.PluralRules` for the active locale.

## Requirements

- Node.js >= 14
- `@hazeljs/core` >= 0.2.0-beta.0

## License

Apache-2.0 © [HazelJS](https://hazeljs.com)
