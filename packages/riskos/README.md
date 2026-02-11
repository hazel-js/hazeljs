# @hazeljs/riskos

**Risk Operating System** - Production-grade module for banking/fintech: KYC/KYB onboarding, fraud/AML risk scoring, investigator assistant, compliance/audit logging, and analytics.

## Architecture

- **Event bus** - Integrates via shared events, not hard imports. Works when `@hazeljs/compliance` and `@hazeljs/analytics` are not installed.
- **Privacy by default** - PII redaction (including deep/recursive), SHA-256 hashing for audit integrity.
- **Auditable** - All decisions produce traces with `requestId`, `tenantId`, `actor`, `purpose`, timestamps, and cryptographically-chained integrity hashes.
- **Pluggable** - Memory store/sink for dev; `PgKycStore` and `PgAuditSink` for production PostgreSQL.

## Quick Start

```ts
import {
  createRiskOS,
  MemoryEventBus,
  MemoryAuditSink,
  PolicyEngine,
  requireTenant,
  DecisionStatus,
} from '@hazeljs/riskos';

const riskos = createRiskOS({
  bus: new MemoryEventBus(),
  auditSink: new MemoryAuditSink(),
  policyEngine: (() => {
    const pe = new PolicyEngine();
    pe.addPolicy(requireTenant());
    return pe;
  })(),
  enforcePolicies: true,
});

const result = await riskos.run(
  'kyc.onboarding',
  { tenantId: 't1', actor: { userId: 'u1', role: 'admin' }, purpose: 'kyc' },
  (ctx) => {
    ctx.metrics.count('kyc.started');
    ctx.emit({ type: 'decision', name: 'kyc', status: DecisionStatus.APPROVED, score: 0, reasons: [] });
    return { ok: true };
  },
);
```

## Components

- **RiskOSRuntime** - `run()`, `createContext()`, `onEvent()`
- **KycEngine** - Config-driven steps: ask, validate, apiCall, transform, verify, decide
- **Risk scoring** - Ruleset DSL with hard blocks, score rules, thresholds
- **Investigator assistant** - Stub agent with tool interfaces
- **Compliance policies** - requireTenant, requirePurpose, denyCrossTenant, piiRedaction, modelAllowlist, etc.

## Production Deployment

### PostgreSQL persistence

1. Run the migration in `sql/migrations/001_riskos_tables.sql`
2. Install `pg`: `npm install pg`
3. Use `PgKycStore` and `PgAuditSink`:

```ts
import { Pool } from 'pg';
import { PgKycStore, PgAuditSink, FetchHttpProvider } from '@hazeljs/riskos';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const store = new PgKycStore({ pool });
const auditSink = new PgAuditSink({ pool });

const sanctions = new FetchHttpProvider('sanctions', {
  baseUrl: 'https://api.your-sanctions-provider.com',
  timeoutMs: 15000,
  apiKeyHeader: 'Authorization',
  apiKeyEnvVar: 'SANCTIONS_API_KEY',
});

const kycEngine = new KycEngine(store, { sanctions });
const riskos = createRiskOS({ auditSink, /* ... */ });
```

`PgAuditSink` maintains hash chain continuity across instances by reading `prevHash` from the database.

### KYC provider (real HTTP)

Use `FetchHttpProvider` for sanctions, document verification, etc. Requires Node 18+ (native fetch). Supports retry, timeout, and API key injection via `resolveSecret`.

## Example

See `examples/riskos-demo/` for a full demo.
