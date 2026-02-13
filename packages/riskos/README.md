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

### Prisma (recommended for hazeljs)

1. Run the migration: `psql $DATABASE_URL -f sql/migrations/001_riskos_tables.sql` (or add to Prisma migrations)

```ts
import { PrismaService } from '@hazeljs/prisma';
import { PrismaKycStore, PrismaAuditSink, FetchHttpProvider } from '@hazeljs/riskos';

const prisma = new PrismaService();

const store = new PrismaKycStore({ prisma });
const auditSink = new PrismaAuditSink({ prisma });

const sanctions = new FetchHttpProvider('sanctions', {
  baseUrl: 'https://api.your-sanctions-provider.com',
  timeoutMs: 15000,
  apiKeyHeader: 'Authorization',
  apiKeyEnvVar: 'SANCTIONS_API_KEY',
});

const kycEngine = new KycEngine(store, { sanctions });
const riskos = createRiskOS({ auditSink, /* ... */ });
```

### PostgreSQL (raw pg)

Alternative when not using Prisma:

```ts
import { Pool } from 'pg';
import { PgKycStore, PgAuditSink } from '@hazeljs/riskos';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const store = new PgKycStore({ pool });
const auditSink = new PgAuditSink({ pool });
```

1. Run the migration in `sql/migrations/001_riskos_tables.sql`
2. Install `pg`: `npm install pg`

`PgAuditSink` and `PrismaAuditSink` maintain hash chain continuity across instances by reading `prevHash` from the database.

### KYC provider (real HTTP)

Use `FetchHttpProvider` for sanctions, document verification, etc. Requires Node 18+ (native fetch). Supports retry, timeout, and API key injection via `resolveSecret`.

**Compatible external APIs** (integrate via `FetchHttpProvider`):
- **KYC / Identity**: Trulioo, ComplyCube, Onfido, Jumio, Youverify, Fourthline
- **Sanctions / AML**: ComplyAdvantage, LSEG World-Check, OFAC-API
- **Document / Liveness**: ARGOS Identity, BlinkID (Microblink), IDEMIA

## AI Investigator (optional)

For a full LLM-powered investigator assistant, use `@hazeljs/riskos-agent`:

```bash
npm install @hazeljs/riskos-agent @hazeljs/ai @hazeljs/agent
```

```ts
import { AIEnhancedService } from '@hazeljs/ai';
import { createInvestigatorRuntime, createKycToolFromStore, createEvidenceToolFromAuditSink } from '@hazeljs/riskos-agent';

const runtime = createInvestigatorRuntime({
  aiService: new AIEnhancedService(),
  tools: { kyc: createKycToolFromStore(store), evidence: createEvidenceToolFromAuditSink(sink), ... },
});
```

See `packages/riskos-agent/README.md` and `example/src/riskos/investigator-example.ts`.

## Example

See `example/src/riskos/` for a full demo.
