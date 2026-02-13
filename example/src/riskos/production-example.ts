/**
 * RiskOS Production Example
 *
 * Requires: DATABASE_URL, Node 18+
 * Run migrations first: psql $DATABASE_URL -f node_modules/@hazeljs/riskos/sql/migrations/001_riskos_tables.sql
 *
 * For KYC providers (sanctions, doc verify): set SANCTIONS_API_KEY etc. in env
 */

import { Pool } from 'pg';
import {
  createRiskOS,
  MemoryEventBus,
  PgKycStore,
  PgAuditSink,
  KycEngine,
  FetchHttpProvider,
  PolicyEngine,
  requireTenant,
  requirePurpose,
  piiRedaction,
} from '@hazeljs/riskos';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

  const store = new PgKycStore({ pool });
  const auditSink = new PgAuditSink({ pool });

  const policyEngine = new PolicyEngine();
  policyEngine.addPolicy(requireTenant());
  policyEngine.addPolicy(requirePurpose());
  policyEngine.addPolicy(piiRedaction());

  const riskos = createRiskOS({
    bus: new MemoryEventBus(),
    auditSink,
    policyEngine,
    enforcePolicies: true,
    appVersion: process.env.APP_VERSION ?? '1.0.0',
  });

  const providers: Record<string, import('@hazeljs/riskos').HttpProvider> = {};
  if (process.env.SANCTIONS_API_URL) {
    providers.sanctions = new FetchHttpProvider('sanctions', {
      baseUrl: process.env.SANCTIONS_API_URL,
      timeoutMs: 15000,
      apiKeyHeader: 'Authorization',
      apiKeyEnvVar: 'SANCTIONS_API_KEY',
      defaultRetry: { maxAttempts: 3, backoffMs: 1000 },
    });
  }

  const kycEngine = new KycEngine(store, providers);

  const session = await kycEngine.createSession('tenant-prod');
  console.log('Created KYC session:', session.id);

  const pack = await auditSink.buildEvidencePack({ tenantId: 'tenant-prod' });
  console.log('Evidence pack:', pack.id, 'traces:', pack.manifest.traceCount);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
