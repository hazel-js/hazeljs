# @hazeljs/riskos-agent

**AI-powered Investigator Agent for RiskOS** — combines `@hazeljs/ai`, `@hazeljs/agent`, and `@hazeljs/riskos` for an intelligent compliance investigator.

## Overview

When you need a **real** LLM-powered investigator (instead of the stub in `@hazeljs/riskos`), use this package. It provides:

- **InvestigatorAgent** – `@Agent` with tools for KYC, evidence, risk history, and transaction timelines
- **createInvestigatorRuntime** – wires AI + Agent + RiskOS together
- **Adapters** – connect RiskOS `KycStore`, `AuditSink` to agent tools

## Installation

```bash
npm install @hazeljs/riskos-agent @hazeljs/ai @hazeljs/agent @hazeljs/riskos
```

## Quick Start (development – in-memory)

```ts
import { AIEnhancedService } from '@hazeljs/ai';
import {
  createInvestigatorRuntime,
  runInvestigator,
  createKycToolFromStore,
  createEvidenceToolFromAuditSink,
  createPlaceholderRiskHistoryTool,
  createPlaceholderTransactionTimelineTool,
} from '@hazeljs/riskos-agent';
import { MemoryKycStore, MemoryAuditSink } from '@hazeljs/riskos';

const kycStore = new MemoryKycStore();
const auditSink = new MemoryAuditSink();

const runtime = createInvestigatorRuntime({
  aiService: new AIEnhancedService(),
  tools: {
    kyc: createKycToolFromStore(kycStore),
    evidence: createEvidenceToolFromAuditSink(auditSink),
    riskHistory: createPlaceholderRiskHistoryTool(),
    transactionTimeline: createPlaceholderTransactionTimelineTool(),
  },
  model: 'gpt-4',
});

const result = await runInvestigator(runtime, {
  caseId: 'case-123',
  question: 'What is the KYC status for session kyc-123?',
});

console.log(result.response);
```

## Persistence Options

The adapters work with **any** `KycStore` and `AuditSink` implementation.

| Component | Development | Production |
|-----------|-------------|------------|
| KYC store | `MemoryKycStore` | `PrismaKycStore` or `PgKycStore` |
| Audit sink | `MemoryAuditSink` | `PrismaAuditSink` or `PgAuditSink` |

### Prisma (recommended for hazeljs)

Use `@hazeljs/prisma` — same connection pool, type safety, migrations:

```ts
import { PrismaService } from '@hazeljs/prisma';
import { PrismaKycStore, PrismaAuditSink } from '@hazeljs/riskos';

const prisma = new PrismaService();  // or inject via DI

const kycStore = new PrismaKycStore({ prisma });
const auditSink = new PrismaAuditSink({ prisma });

tools: {
  kyc: createKycToolFromStore(kycStore),
  evidence: createEvidenceToolFromAuditSink(auditSink),
  // ...
}
```

1. Run the RiskOS migration: `psql $DATABASE_URL -f node_modules/@hazeljs/riskos/sql/migrations/001_riskos_tables.sql`
2. Add the tables to your Prisma schema (or use raw SQL migration)

### PostgreSQL (raw pg)

Alternative if not using Prisma:

```ts
import { Pool } from 'pg';
import { PgKycStore, PgAuditSink } from '@hazeljs/riskos';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const kycStore = new PgKycStore({ pool });
const auditSink = new PgAuditSink({ pool });
```

## Integration with AI, Agent, and RAG

```
@hazeljs/ai          → LLM providers (OpenAI, Anthropic, etc.)
       ↓
@hazeljs/rag         → Memory, RAG pipeline (optional)
       ↓
@hazeljs/agent       → Agent runtime, tools, execution loop
       ↓
@hazeljs/riskos      → KYC, audit, compliance domain
       ↓
@hazeljs/riskos-agent → Investigator Agent (this package)
```

## API

- **createInvestigatorRuntime(options)** – Returns `AgentRuntime` with InvestigatorAgent
- **runInvestigator(runtime, input)** – Convenience method for a single question
- **InvestigatorAgent** – The agent class (use with custom runtime if needed)
- **createKycToolFromStore(store)** – Adapter from `KycStore` to KYC tool
- **createEvidenceToolFromAuditSink(sink)** – Adapter from `AuditSink` to evidence tool
- **createPlaceholderRiskHistoryTool()** – Placeholder (replace with real impl)
- **createPlaceholderTransactionTimelineTool()** – Placeholder (replace with real impl)

## License

MIT
