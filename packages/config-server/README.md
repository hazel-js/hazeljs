# @hazeljs/config-server

**Git-backed configuration. One repo, every service, refresh without a restart.**

Spring Cloud Config for TypeScript: clone a config repo, overlay `application` + `{app}` + `{profile}` files, decrypt `{cipher}` secrets, serve over HTTP, and pull updates on demand.

[![npm version](https://img.shields.io/npm/v/@hazeljs/config-server.svg)](https://www.npmjs.com/package/@hazeljs/config-server)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/config-server)](https://www.npmjs.com/package/@hazeljs/config-server)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Use `@hazeljs/config` for local `.env` / schema validation. Use **this package** when many services should read the same Git repo.

## Features

- Git clone / fetch / checkout by **label** (branch or tag)
- Search paths with `{application}`, `{profile}`, `{label}`
- Override order: `application` → `application-{profile}` → `{app}` → `{app}-{profile}`
- YAML, JSON, `.properties`, `.env`
- AES-256-GCM `{cipher}v1:...` (passphrase or key file — not a Java keystore)
- HTTP API: `GET /{application}/{profile}/{label}`, `/refresh`, `/encrypt`, `/decrypt`, `/audit`
- Client with `refresh()` and `@ConfigValue({ refresh: true })`
- Audit trail of clone, resolve, encrypt, and fetch

## Installation

```bash
npm install @hazeljs/config-server
```

The server shells out to `git`. Clients only need HTTP.

## Config repo layout

```
application.yml                 # shared defaults
application-prod.yml            # shared prod overlay
user-service.yml
user-service-prod.yml
configs/user-service/prod/      # optional searchPath
  extra.yml
```

Later files win. Nested keys work with dotted getters: `database.url`.

## Run a server

```typescript
import { ConfigServer } from '@hazeljs/config-server';

const server = new ConfigServer({
  git: {
    uri: 'https://github.com/org/config-repo',
    searchPaths: ['configs/{application}/{profile}'],
    defaultLabel: 'main',
  },
  encryption: {
    enabled: true,
    key: process.env.CONFIG_SERVER_ENCRYPT_KEY,
  },
  port: 8888,
  refreshInterval: 60_000,
});

await server.start();
```

HTTPS Git: set `git.username` + `git.password` (PAT). Local path or `file://` also works.

Decorator form (stores options for `forRoot`):

```typescript
import { EnableConfigServer, ConfigServerModule } from '@hazeljs/config-server';

@EnableConfigServer({
  git: { uri: 'https://github.com/org/config-repo', defaultLabel: 'main' },
  encryption: { enabled: true, key: process.env.CONFIG_SERVER_ENCRYPT_KEY },
  profiles: ['dev', 'staging', 'prod'],
})
export class AppConfigServer {}

ConfigServerModule.forRoot({
  git: { uri: 'https://github.com/org/config-repo' },
  port: 8888,
});
```

## HTTP API

| Method | Path                               | Purpose                                            |
| ------ | ---------------------------------- | -------------------------------------------------- |
| GET    | `/{application}/{profile}`         | Merged environment (`profile` may be `prod,cloud`) |
| GET    | `/{application}/{profile}/{label}` | Same, pinned to a Git ref                          |
| POST   | `/refresh`                         | `git fetch` + checkout                             |
| POST   | `/encrypt`                         | plaintext → `{cipher}v1:...`                       |
| POST   | `/decrypt`                         | cipher → plaintext                                 |
| GET    | `/health`                          | liveness + current SHA                             |
| GET    | `/audit`                           | recent config events                               |

Response shape:

```json
{
  "name": "user-service",
  "profiles": ["prod"],
  "label": "main",
  "version": "abc123...",
  "propertySources": [{ "name": "application.yml", "source": {} }],
  "config": { "database": { "url": "postgres://..." } }
}
```

## Client

```typescript
import { ConfigClient, ConfigValue } from '@hazeljs/config-server';

const client = new ConfigClient({
  uri: 'http://localhost:8888',
  application: 'user-service',
  profiles: ['prod'],
  label: 'main',
  refreshInterval: 30_000,
});
await client.load();

client.get('database.url');
await client.refresh();

class AppConfig {
  @ConfigValue('database.url', { refresh: true })
  dbUrl!: string;

  @ConfigValue('features.newAlgorithm', { default: false, type: 'boolean' })
  useNewAlgorithm!: boolean;

  @ConfigValue('api.timeout', { type: 'number' })
  apiTimeout!: number;
}
```

In-process (no HTTP), pass `server` instead of `uri`.

## Encryption

Java `.jks` keystores are JVM-specific. This package uses **AES-256-GCM**. Put the passphrase in `CONFIG_SERVER_ENCRYPT_KEY` or `encryption.keyFile`.

```typescript
const cipher = server.encrypt('my-db-password');
// paste into YAML:
// database:
//   password: '{cipher}v1:...'
```

Values are decrypted when the environment is served. Do not commit the key next to the ciphertext.

## Native directory (no Git)

```typescript
new ConfigServer({ nativePath: './config-files', port: 8888 });
```

Useful in tests and air-gapped images. Production should use `git.uri`.
