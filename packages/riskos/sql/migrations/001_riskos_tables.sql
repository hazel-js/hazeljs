-- RiskOS production tables for PostgreSQL
-- Run this migration in your database before using PgKycStore and PgAuditSink

-- KYC sessions
CREATE TABLE IF NOT EXISTS riskos_kyc_sessions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answers JSONB NOT NULL DEFAULT '{}',
  documents JSONB NOT NULL DEFAULT '{}',
  raw JSONB NOT NULL DEFAULT '{}',
  normalized JSONB NOT NULL DEFAULT '{}',
  checks JSONB NOT NULL DEFAULT '{}',
  decision JSONB
);

CREATE INDEX IF NOT EXISTS idx_riskos_kyc_sessions_tenant ON riskos_kyc_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_riskos_kyc_sessions_updated ON riskos_kyc_sessions(updated_at);

-- Audit traces (append-only for hash chain)
CREATE TABLE IF NOT EXISTS riskos_audit_traces (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  ts_start TIMESTAMPTZ NOT NULL,
  ts_end TIMESTAMPTZ NOT NULL,
  tenant_id VARCHAR(128),
  actor JSONB,
  purpose VARCHAR(256),
  action_name VARCHAR(128) NOT NULL,
  policy_results JSONB,
  data_access_events JSONB,
  ai_call_events JSONB,
  decision_events JSONB,
  error TEXT,
  integrity_hash VARCHAR(64) NOT NULL,
  prev_hash VARCHAR(64) NOT NULL,
  versions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riskos_audit_request ON riskos_audit_traces(request_id);
CREATE INDEX IF NOT EXISTS idx_riskos_audit_tenant ON riskos_audit_traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_riskos_audit_ts ON riskos_audit_traces(ts_start);
CREATE UNIQUE INDEX IF NOT EXISTS idx_riskos_audit_chain ON riskos_audit_traces(integrity_hash);
